import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  AgentCancelRequest,
  AgentCancelResponse,
  AgentResumeRequest,
  AgentRunRequest,
  AgentRunStatus,
  AgentStreamEvent,
  ClarificationQuestion,
} from "@autix/requirement-deepagent-contracts";
import type { RequirementRuntimeConfig } from "../model/model.config";
import { InvalidAgentOutputError } from "./runtime/deepagent.runtime";
import {
  REQUIREMENT_RUNTIME,
  REQUIREMENT_RUNTIME_CONFIG,
  type RequirementRuntime,
  type RequirementRuntimeEvent,
} from "./runtime/runtime.types";

type EventWithoutEnvelope =
  | RequirementRuntimeEvent
  | { type: "run.started"; inputChars: number }
  | { type: "run.resumed"; answerCount: number }
  | { type: "run.paused"; status: "waiting" }
  | {
      type: "run.error";
      code:
        | "MODEL_NOT_CONFIGURED"
        | "AGENT_TIMEOUT"
        | "AGENT_OUTPUT_INVALID"
        | "AGENT_RUN_FAILED";
      message: string;
    }
  | { type: "run.cancelled"; message: string }
  | { type: "run.done"; status: AgentRunStatus };

type StoredRunStatus =
  | "running"
  | "waiting"
  | "resuming"
  | AgentRunStatus;

interface StoredRun {
  runId: string;
  threadId: string;
  sequence: number;
  status: StoredRunStatus;
  questions: ClarificationQuestion[];
  resumeRequestIds: Set<string>;
  cancelEvents?: AgentStreamEvent[];
}

function publicFailure(error: unknown): Extract<EventWithoutEnvelope, { type: "run.error" }> {
  if (error instanceof InvalidAgentOutputError) {
    return {
      type: "run.error",
      code: "AGENT_OUTPUT_INVALID",
      message: "Agent 已结束，但没有生成必需的最终报告产物。",
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("OPENAI_API_KEY")) {
    return {
      type: "run.error",
      code: "MODEL_NOT_CONFIGURED",
      message: "尚未配置模型密钥，请先完成模型诊断。",
    };
  }
  return {
    type: "run.error",
    code: "AGENT_RUN_FAILED",
    message: "需求分析运行失败，请根据 runId 查看服务端日志。",
  };
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly runs = new Map<string, StoredRun>();

  constructor(
    @Inject(REQUIREMENT_RUNTIME)
    private readonly runtime: RequirementRuntime,
    @Inject(REQUIREMENT_RUNTIME_CONFIG)
    private readonly runtimeConfig: RequirementRuntimeConfig,
  ) {}

  async *stream(
    request: AgentRunRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<AgentStreamEvent> {
    const runId = randomUUID();
    const threadId = request.threadId?.trim() || randomUUID();
    let status: AgentRunStatus = "completed";
    let reportCompleted = false;
    let waiting = false;
    let timedOut = false;
    const storedRun: StoredRun = {
      runId,
      threadId,
      sequence: 0,
      status: "running",
      questions: [],
      resumeRequestIds: new Set(),
    };
    this.runs.set(runId, storedRun);
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("requirement agent run timed out"));
    }, this.runtimeConfig.runTimeoutMs);

    const withEnvelope = (event: EventWithoutEnvelope): AgentStreamEvent =>
      this.withEnvelope(storedRun, event);

    this.logger.log(
      `[run:${runId}] started thread=${threadId} inputChars=${request.input.length}`,
    );
    yield withEnvelope({ type: "run.started", inputChars: request.input.length });

    try {
      if (signal?.aborted) {
        status = "cancelled";
      } else {
        for await (const event of this.runtime.stream(request.input, {
          runId,
          threadId,
          signal: controller.signal,
          recursionLimit: this.runtimeConfig.recursionLimit,
        })) {
          if (controller.signal.aborted) break;
          if (event.type === "report.completed") reportCompleted = true;
          if (event.type === "clarification.required") {
            waiting = true;
            storedRun.questions = event.questions;
          }
          this.logProgress(runId, event);
          yield withEnvelope(event);
        }

        if (controller.signal.aborted) {
          if (timedOut) {
            status = "failed";
            yield withEnvelope({
              type: "run.error",
              code: "AGENT_TIMEOUT",
              message: `需求分析超过 ${this.runtimeConfig.runTimeoutMs}ms，已安全终止。`,
            });
          } else {
            status = "cancelled";
          }
        } else if (!reportCompleted && !waiting) {
          throw new InvalidAgentOutputError("runtime ended without a report event");
        }
      }
    } catch (error) {
      if (signal?.aborted) {
        status = "cancelled";
      } else if (timedOut) {
        status = "failed";
        yield withEnvelope({
          type: "run.error",
          code: "AGENT_TIMEOUT",
          message: `需求分析超过 ${this.runtimeConfig.runTimeoutMs}ms，已安全终止。`,
        });
      } else {
        status = "failed";
        this.logger.error(
          `[run:${runId}] failed`,
          error instanceof Error ? error.stack : String(error),
        );
        yield withEnvelope(publicFailure(error));
      }
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", forwardAbort);
    }

    if (waiting && status === "completed") {
      storedRun.status = "waiting";
      this.logger.log(`[run:${runId}] paused questions=${storedRun.questions.length}`);
      yield withEnvelope({ type: "run.paused", status: "waiting" });
      return;
    }

    if (status === "cancelled") {
      this.logger.log(`[run:${runId}] cancelled`);
      yield withEnvelope({
        type: "run.cancelled",
        message: "用户已取消本次需求分析。",
      });
    }

    storedRun.status = status;
    this.logger.log(`[run:${runId}] done status=${status}`);
    yield withEnvelope({ type: "run.done", status });
  }

  validateResumeRequest(runId: string, request: AgentResumeRequest): void {
    this.resumableRun(runId, request);
  }

  async *resume(
    runId: string,
    request: AgentResumeRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<AgentStreamEvent> {
    const storedRun = this.resumableRun(runId, request);
    storedRun.status = "resuming";
    storedRun.resumeRequestIds.add(request.requestId);
    let status: AgentRunStatus = "completed";
    let reportCompleted = false;
    let waiting = false;
    let timedOut = false;
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("requirement agent resume timed out"));
    }, this.runtimeConfig.runTimeoutMs);
    const withEnvelope = (event: EventWithoutEnvelope): AgentStreamEvent =>
      this.withEnvelope(storedRun, event);

    this.logger.log(
      `[run:${runId}] resumed thread=${storedRun.threadId} answers=${request.answers.length}`,
    );
    yield withEnvelope({
      type: "run.resumed",
      answerCount: request.answers.length,
    });

    try {
      for await (const event of this.runtime.resume(request.answers, {
        runId,
        threadId: storedRun.threadId,
        signal: controller.signal,
        recursionLimit: this.runtimeConfig.recursionLimit,
      })) {
        if (controller.signal.aborted) break;
        if (event.type === "report.completed") reportCompleted = true;
        if (event.type === "clarification.required") {
          waiting = true;
          storedRun.questions = event.questions;
        }
        this.logProgress(runId, event);
        yield withEnvelope(event);
      }

      if (controller.signal.aborted) {
        if (timedOut) {
          status = "failed";
          yield withEnvelope({
            type: "run.error",
            code: "AGENT_TIMEOUT",
            message: `需求分析恢复超过 ${this.runtimeConfig.runTimeoutMs}ms，已安全终止。`,
          });
        } else {
          status = "cancelled";
        }
      } else if (!reportCompleted && !waiting) {
        throw new InvalidAgentOutputError("resume ended without a report event");
      }
    } catch (error) {
      if (signal?.aborted) {
        status = "cancelled";
      } else if (timedOut) {
        status = "failed";
        yield withEnvelope({
          type: "run.error",
          code: "AGENT_TIMEOUT",
          message: `需求分析恢复超过 ${this.runtimeConfig.runTimeoutMs}ms，已安全终止。`,
        });
      } else {
        status = "failed";
        this.logger.error(
          `[run:${runId}] resume failed`,
          error instanceof Error ? error.stack : String(error),
        );
        yield withEnvelope(publicFailure(error));
      }
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", forwardAbort);
    }

    if (waiting && status === "completed") {
      storedRun.status = "waiting";
      yield withEnvelope({ type: "run.paused", status: "waiting" });
      return;
    }
    if (status === "cancelled") {
      yield withEnvelope({
        type: "run.cancelled",
        message: "用户已取消本次需求分析。",
      });
    }
    storedRun.status = status;
    this.logger.log(`[run:${runId}] done status=${status}`);
    yield withEnvelope({ type: "run.done", status });
  }

  cancel(runId: string, request: AgentCancelRequest): AgentCancelResponse {
    const storedRun = this.runs.get(runId);
    if (!storedRun) throw new NotFoundException("找不到指定的运行记录。");
    if (storedRun.threadId !== request.threadId) {
      throw new BadRequestException("threadId 与运行记录不匹配。");
    }
    if (storedRun.status === "cancelled" && storedRun.cancelEvents) {
      return {
        runId,
        threadId: storedRun.threadId,
        status: "cancelled",
        events: storedRun.cancelEvents,
      };
    }
    if (storedRun.status !== "waiting") {
      throw new ConflictException("只有等待澄清的运行可以通过该接口放弃。");
    }

    storedRun.status = "cancelled";
    const events = [
      this.withEnvelope(storedRun, {
        type: "run.cancelled",
        message: "用户已放弃补充信息，本次分析已取消。",
      }),
      this.withEnvelope(storedRun, { type: "run.done", status: "cancelled" }),
    ];
    storedRun.cancelEvents = events;
    this.logger.log(`[run:${runId}] waiting run cancelled`);
    return {
      runId,
      threadId: storedRun.threadId,
      status: "cancelled",
      events,
    };
  }

  private resumableRun(
    runId: string,
    request: AgentResumeRequest,
  ): StoredRun {
    const storedRun = this.runs.get(runId);
    if (!storedRun) throw new NotFoundException("找不到指定的运行记录。");
    if (storedRun.threadId !== request.threadId) {
      throw new BadRequestException("threadId 与运行记录不匹配。");
    }
    if (!request.requestId.trim()) {
      throw new BadRequestException("requestId 不能为空。");
    }
    if (storedRun.resumeRequestIds.has(request.requestId)) {
      throw new ConflictException("该澄清提交已经处理，不会重复执行。");
    }
    if (storedRun.status !== "waiting") {
      throw new ConflictException("当前运行不处于等待澄清状态。");
    }

    const expected = new Map(
      storedRun.questions.map((question) => [question.id, question]),
    );
    const answers = new Map<string, string>();
    for (const answer of request.answers) {
      if (!expected.has(answer.questionId)) {
        throw new BadRequestException(`未知的澄清问题：${answer.questionId}`);
      }
      if (answers.has(answer.questionId)) {
        throw new BadRequestException(`澄清问题重复回答：${answer.questionId}`);
      }
      answers.set(answer.questionId, answer.value.trim());
    }
    for (const question of storedRun.questions) {
      if (question.required && !answers.get(question.id)) {
        throw new BadRequestException(`请回答必填问题：${question.label}`);
      }
    }
    return storedRun;
  }

  private withEnvelope(
    storedRun: StoredRun,
    event: EventWithoutEnvelope,
  ): AgentStreamEvent {
    return {
      ...event,
      runId: storedRun.runId,
      threadId: storedRun.threadId,
      sequence: ++storedRun.sequence,
      timestamp: new Date().toISOString(),
    } as AgentStreamEvent;
  }

  private logProgress(runId: string, event: RequirementRuntimeEvent): void {
    if (event.type === "agent.progress") {
      this.logger.log(
        `[run:${runId}] agent=${event.agent} status=${event.status}`,
      );
    } else if (event.type === "tool.progress") {
      this.logger.log(
        `[run:${runId}] agent=${event.agent} tool=${event.tool} status=${event.status}`,
      );
    } else if (event.type === "plan.updated") {
      this.logger.log(`[run:${runId}] todos=${event.todos.length}`);
    } else if (event.type === "artifact.available") {
      this.logger.log(
        `[run:${runId}] artifact=${event.artifact.path} chars=${event.artifact.sizeChars}`,
      );
    } else if (event.type === "clarification.required") {
      this.logger.log(
        `[run:${runId}] clarification questions=${event.questions.length} score=${event.assessment.score}`,
      );
    }
  }
}
