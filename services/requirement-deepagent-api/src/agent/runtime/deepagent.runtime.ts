import { Inject, Injectable, Optional } from "@nestjs/common";
import { Command } from "@langchain/langgraph";
import type { ClarificationAnswer } from "@autix/requirement-deepagent-contracts";
import { createRequirementDeepAgent } from "../agent.factory";
import type { ClarificationInterruptPayload } from "../clarification.tool";
import { REQUIREMENT_COORDINATOR_NAME } from "../root/coordinator.prompt";
import { REQUIREMENT_ANALYST_NAME } from "../subagents/requirement-analyst";
import {
  readModelRuntimeConfig,
  readRequirementRuntimeConfig,
} from "../../model/model.config";
import { createRequirementModel } from "../../model/model.factory";
import {
  exportTodos,
  exportWorkArtifacts,
  finalReportFromArtifacts,
} from "./state-exporter";
import type {
  RequirementRuntime,
  RequirementRuntimeEvent,
  RuntimeRunOptions,
} from "./runtime.types";

interface RawStreamEvent {
  event: string;
  name?: string;
  run_id?: string;
  parent_ids?: string[];
  data?: unknown;
}

export const REQUIREMENT_DEEP_AGENT_OVERRIDE = Symbol(
  "REQUIREMENT_DEEP_AGENT_OVERRIDE",
);

type UnknownRecord = Record<string, unknown>;

export class InvalidAgentOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAgentOutputError";
  }
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object"
    ? (value as UnknownRecord)
    : undefined;
}

function parseObject(value: unknown): UnknownRecord | undefined {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  return asRecord(value);
}

function toolInput(event: RawStreamEvent): UnknownRecord | undefined {
  const data = asRecord(event.data);
  const direct = parseObject(data?.input);
  return parseObject(direct?.input) ?? direct;
}

function subagentName(event: RawStreamEvent): string | undefined {
  const name = toolInput(event)?.subagent_type;
  return typeof name === "string" ? name : undefined;
}

function toolMessage(event: RawStreamEvent): string | undefined {
  const input = toolInput(event);
  if (!input) return undefined;
  if (event.name === "write_todos" && Array.isArray(input.todos)) {
    return `更新 ${input.todos.length} 个计划事项`;
  }
  if (event.name === "task") {
    const name = subagentName(event);
    return name ? `委派给 ${name}` : "委派子 Agent";
  }
  const path = input.path ?? input.file_path;
  return typeof path === "string" ? `虚拟路径 ${path}` : undefined;
}

function todosFromTool(event: RawStreamEvent) {
  const todos = toolInput(event)?.todos;
  return exportTodos({ todos });
}

function agentForEvent(
  event: RawStreamEvent,
  analystTaskRunIds: Set<string>,
) {
  return event.parent_ids?.some((id) => analystTaskRunIds.has(id))
    ? REQUIREMENT_ANALYST_NAME
    : REQUIREMENT_COORDINATOR_NAME;
}

function clarificationPayload(value: unknown): ClarificationInterruptPayload | undefined {
  const payload = asRecord(value);
  const assessment = asRecord(payload?.assessment);
  if (
    payload?.kind !== "requirement_clarification" ||
    assessment?.complete !== false ||
    !Array.isArray(payload.questions)
  ) {
    return undefined;
  }
  return payload as unknown as ClarificationInterruptPayload;
}

function clarificationFromState(
  finalState: unknown,
  snapshot: unknown,
): ClarificationInterruptPayload | undefined {
  const stateInterrupts = asRecord(finalState)?.__interrupt__;
  if (Array.isArray(stateInterrupts)) {
    for (const item of stateInterrupts) {
      const payload = clarificationPayload(asRecord(item)?.value);
      if (payload) return payload;
    }
  }
  const tasks = asRecord(snapshot)?.tasks;
  if (!Array.isArray(tasks)) return undefined;
  for (const task of tasks) {
    const interrupts = asRecord(task)?.interrupts;
    if (!Array.isArray(interrupts)) continue;
    for (const item of interrupts) {
      const payload = clarificationPayload(asRecord(item)?.value);
      if (payload) return payload;
    }
  }
  return undefined;
}

@Injectable()
export class DeepAgentRuntime implements RequirementRuntime {
  private agent?: ReturnType<typeof createRequirementDeepAgent>;

  constructor(
    @Optional()
    @Inject(REQUIREMENT_DEEP_AGENT_OVERRIDE)
    agent?: ReturnType<typeof createRequirementDeepAgent>,
  ) {
    this.agent = agent;
  }

  private getAgent(): ReturnType<typeof createRequirementDeepAgent> {
    if (this.agent) return this.agent;
    const modelConfig = readModelRuntimeConfig();
    const runtimeConfig = readRequirementRuntimeConfig();
    this.agent = createRequirementDeepAgent(
      createRequirementModel(modelConfig, runtimeConfig),
    );
    return this.agent;
  }

  async *stream(
    input: string,
    options: RuntimeRunOptions,
  ): AsyncGenerator<RequirementRuntimeEvent> {
    yield* this.run(
      { messages: [{ role: "user", content: input }] },
      options,
      "开始判断需求完整性并规划分析",
    );
  }

  async *resume(
    answers: ClarificationAnswer[],
    options: RuntimeRunOptions,
  ): AsyncGenerator<RequirementRuntimeEvent> {
    yield* this.run(
      new Command({
        resume: {
          kind: "requirement_clarification_answers",
          answers,
        },
      }),
      options,
      "收到澄清答案，继续原需求分析",
    );
  }

  private async *run(
    agentInput: unknown,
    options: RuntimeRunOptions,
    startMessage: string,
  ): AsyncGenerator<RequirementRuntimeEvent> {
    yield {
      type: "agent.progress",
      agent: REQUIREMENT_COORDINATOR_NAME,
      status: "started",
      message: startMessage,
    };

    let rootRunId: string | undefined;
    let finalState: unknown;
    const analystTaskRunIds = new Set<string>();
    let analystStarted = false;
    let analystCompleted = false;

    const agent = this.getAgent();
    const runnableConfig = {
      signal: options.signal,
      recursionLimit: options.recursionLimit,
      configurable: { thread_id: options.threadId },
    };
    const rawEvents = await agent.streamEvents(agentInput as never, runnableConfig);

    for await (const rawEvent of rawEvents as AsyncIterable<RawStreamEvent>) {
      if (options.signal.aborted) return;
      const event = rawEvent;

      if (event.event === "on_chain_start" && !rootRunId && event.run_id) {
        rootRunId = event.run_id;
        continue;
      }

      if (event.event === "on_tool_start") {
        const agent = agentForEvent(event, analystTaskRunIds);
        yield {
          type: "tool.progress",
          agent,
          tool: event.name ?? "unknown",
          status: "started",
          message: toolMessage(event),
        };

        if (event.name === "write_todos") {
          const todos = todosFromTool(event);
          if (todos.length > 0) yield { type: "plan.updated", todos };
        }

        if (
          event.name === "task" &&
          subagentName(event) === REQUIREMENT_ANALYST_NAME
        ) {
          if (event.run_id) analystTaskRunIds.add(event.run_id);
          if (!analystStarted) {
            analystStarted = true;
            yield {
              type: "agent.progress",
              agent: REQUIREMENT_ANALYST_NAME,
              status: "started",
              message: "正在分析需求完整性、风险与验收标准",
            };
          }
        }
        continue;
      }

      if (event.event === "on_tool_end") {
        const agent = agentForEvent(event, analystTaskRunIds);
        yield {
          type: "tool.progress",
          agent,
          tool: event.name ?? "unknown",
          status: "completed",
          message: toolMessage(event),
        };
        if (
          event.name === "task" &&
          event.run_id &&
          analystTaskRunIds.has(event.run_id) &&
          !analystCompleted
        ) {
          analystCompleted = true;
          yield {
            type: "agent.progress",
            agent: REQUIREMENT_ANALYST_NAME,
            status: "completed",
            message: "需求专家已返回分析结果",
          };
        }
        continue;
      }

      if (event.event === "on_tool_error") {
        yield {
          type: "tool.progress",
          agent: agentForEvent(event, analystTaskRunIds),
          tool: event.name ?? "unknown",
          status: "failed",
          message: "工具执行失败",
        };
        continue;
      }

      if (
        event.event === "on_chain_end" &&
        rootRunId &&
        event.run_id === rootRunId
      ) {
        finalState = asRecord(event.data)?.output;
      }
    }

    const snapshot = await agent.getState(runnableConfig);
    const clarification = clarificationFromState(finalState, snapshot);
    if (clarification) {
      yield {
        type: "clarification.required",
        assessment: clarification.assessment,
        questions: clarification.questions,
      };
      return;
    }
    finalState = asRecord(snapshot)?.values ?? finalState;
    const artifacts = exportWorkArtifacts(finalState);
    const todos = exportTodos(finalState);
    const report = finalReportFromArtifacts(artifacts);
    if (!report?.trim()) {
      throw new InvalidAgentOutputError(
        "DeepAgent completed without /work/final-report.md",
      );
    }

    for (const artifact of artifacts) {
      yield { type: "artifact.available", artifact };
    }
    yield {
      type: "agent.progress",
      agent: REQUIREMENT_COORDINATOR_NAME,
      status: "completed",
      message: "最终报告和虚拟产物已完成",
    };
    yield {
      type: "report.completed",
      report,
      artifacts,
      todos,
      usedAgents: [REQUIREMENT_COORDINATOR_NAME, REQUIREMENT_ANALYST_NAME],
    };
  }
}
