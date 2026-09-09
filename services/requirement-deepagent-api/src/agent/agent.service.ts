import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  AgentRunRequest,
  AgentRunStatus,
  AgentStreamEvent,
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
    let sequence = 0;
    let status: AgentRunStatus = "completed";
    let reportCompleted = false;
    let timedOut = false;
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("requirement agent run timed out"));
    }, this.runtimeConfig.runTimeoutMs);

    const withEnvelope = (event: EventWithoutEnvelope): AgentStreamEvent =>
      ({
        ...event,
        runId,
        threadId,
        sequence: ++sequence,
        timestamp: new Date().toISOString(),
      }) as AgentStreamEvent;

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
        } else if (!reportCompleted) {
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

    if (status === "cancelled") {
      this.logger.log(`[run:${runId}] cancelled`);
      yield withEnvelope({
        type: "run.cancelled",
        message: "用户已取消本次需求分析。",
      });
    }

    this.logger.log(`[run:${runId}] done status=${status}`);
    yield withEnvelope({ type: "run.done", status });
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
    }
  }
}
