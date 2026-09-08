import { Injectable, Logger } from "@nestjs/common";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { FileData } from "deepagents";
import { createRequirementAgent } from "./agent.factory";
import { createConfiguredModel } from "./model.factory";
import { loadRequirementSkillFiles } from "./skill-files";
import { REQUIREMENT_SUBAGENT_NAMES } from "./subagents/requirement.subagents";
import type { AgentRuntime, RuntimeContext, RuntimeEvent } from "./types";

type V2StreamEvent = {
  event: string;
  name: string;
  run_id?: string;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

type DeepAgentState = {
  messages?: Array<{ content?: unknown }>;
  todos?: Array<{ content?: unknown; status?: unknown }>;
  files?: Record<string, FileData | undefined>;
};

type ActiveTool = {
  agent: string;
  name: string;
};

const ROOT_AGENT_NAME = "requirement-coordinator";
const PUBLIC_COORDINATOR_NAME = "coordinator";
const runtimeLogger = new Logger("DeepAgentRuntime");
const REQUIRED_ARTIFACTS = [
  "/work/requirement-analysis.md",
  "/work/risk-review.md",
  "/work/acceptance-criteria.md",
  "/work/final-report.md",
] as const;

function recursionLimit(): number {
  const configured = Number(process.env.DEEPAGENT_RECURSION_LIMIT ?? 80);
  return Number.isInteger(configured) && configured >= 10 ? configured : 80;
}

function fileText(file: FileData | undefined): string | undefined {
  if (!file) return undefined;
  if (Array.isArray(file.content)) return file.content.join("\n");
  return typeof file.content === "string" ? file.content : undefined;
}

function projectResult(
  state: DeepAgentState,
  usedAgents: Set<string>,
  toolCalls: string[],
): Extract<RuntimeEvent, { type: "final" }> {
  const artifacts = Object.fromEntries(
    Object.entries(state.files ?? {})
      .filter(([path]) => path.startsWith("/work/"))
      .map(([path, file]) => [path, fileText(file)])
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const missingArtifacts = REQUIRED_ARTIFACTS.filter(
    (path) => !artifacts[path]?.trim(),
  );
  if (missingArtifacts.length > 0) {
    throw new Error(
      `DeepAgent 未生成必需产物：${missingArtifacts.join(", ")}`,
    );
  }

  const missingAgents = REQUIREMENT_SUBAGENT_NAMES.filter(
    (name) => !usedAgents.has(name),
  );
  if (missingAgents.length > 0) {
    throw new Error(
      `DeepAgent 未完成必需专家委派：${missingAgents.join(", ")}`,
    );
  }

  const allowedStatuses = new Set(["pending", "in_progress", "completed"]);
  const todos = (state.todos ?? []).map((todo) => {
    if (
      typeof todo.content !== "string" ||
      !todo.content.trim() ||
      typeof todo.status !== "string" ||
      !allowedStatuses.has(todo.status)
    ) {
      throw new Error("DeepAgent 返回了无效的计划项");
    }
    return {
      content: todo.content,
      status: todo.status as "pending" | "in_progress" | "completed",
    };
  });
  if (todos.length === 0 || todos.some((todo) => todo.status !== "completed")) {
    throw new Error("DeepAgent 未完成全部计划项");
  }

  return {
    type: "final",
    report: artifacts["/work/final-report.md"],
    todos,
    artifacts,
    usedAgents: [...REQUIREMENT_SUBAGENT_NAMES],
    toolCalls,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function checkpointNamespace(event: V2StreamEvent): string | undefined {
  const value = event.metadata?.langgraph_checkpoint_ns;
  return typeof value === "string" ? value : undefined;
}

function parseToolInput(event: V2StreamEvent): Record<string, unknown> {
  const rawInput = event.data?.input;
  const input = asRecord(rawInput)?.input ?? rawInput;
  if (typeof input !== "string") return asRecord(input) ?? {};
  try {
    return asRecord(JSON.parse(input)) ?? {};
  } catch {
    return {};
  }
}

function ownerForNamespace(
  namespace: string | undefined,
  namespaceOwners: Map<string, string>,
): string {
  if (!namespace) return PUBLIC_COORDINATOR_NAME;

  let owner = PUBLIC_COORDINATOR_NAME;
  let matchedLength = -1;
  for (const [prefix, agent] of namespaceOwners) {
    if (
      (namespace === prefix || namespace.startsWith(`${prefix}|`)) &&
      prefix.length > matchedLength
    ) {
      owner = agent;
      matchedLength = prefix.length;
    }
  }
  return owner;
}

function isRequirementSubagent(name: string): boolean {
  return (REQUIREMENT_SUBAGENT_NAMES as readonly string[]).includes(name);
}

export async function* streamRequirementWithModel(
  model: BaseChatModel,
  input: string,
  context: RuntimeContext,
): AsyncGenerator<RuntimeEvent> {
  yield { type: "progress", agent: "coordinator", status: "started" };

  const agent = createRequirementAgent(model);
  const files = await loadRequirementSkillFiles();
  const initialState = {
    messages: [{ role: "user", content: input }],
    files,
  };
  const events = agent.streamEvents(
    // deepagents 1.10.2 的运行时支持 files，但该字段尚未进入这里的泛型投影。
    initialState as never,
    {
      // v2 是当前依赖组合的安全路径；v3 的重复 subagent transformer
      // 在失败时会留下应用无法访问的 rejected Promise。
      version: "v2",
      recursionLimit: recursionLimit(),
      configurable: { runId: context.runId, threadId: context.threadId },
      signal: context.signal,
    },
  ) as AsyncIterable<V2StreamEvent>;

  const usedAgents = new Set<string>();
  const toolCalls: string[] = [];
  const namespaceOwners = new Map<string, string>();
  const activeSubagents = new Map<string, string>();
  const activeTools = new Map<string, ActiveTool>();
  let rootRunId: string | undefined;
  let finalState: DeepAgentState | undefined;

  try {
    for await (const event of events) {
      if (context.signal?.aborted) return;
      if (process.env.DEEPAGENT_LOG_RAW_EVENTS === "1") {
        runtimeLogger.debug(
          `[run:${context.runId}] raw event=${event.event} name=${event.name || "-"} runId=${event.run_id || "-"} namespace=${checkpointNamespace(event) || "-"}`,
        );
      }

      if (event.event === "on_chain_start") {
        if (event.name === ROOT_AGENT_NAME && !rootRunId) {
          rootRunId = event.run_id;
        } else if (isRequirementSubagent(event.name)) {
          if (event.run_id) activeSubagents.set(event.run_id, event.name);
          const namespace = checkpointNamespace(event);
          if (namespace) namespaceOwners.set(namespace, event.name);
          yield {
            type: "progress",
            agent: event.name,
            status: "started",
          };
        }
        continue;
      }

      if (event.event === "on_chain_end") {
        if (event.run_id && event.run_id === rootRunId) {
          finalState = asRecord(event.data?.output) as DeepAgentState | undefined;
          continue;
        }
        const subagent = event.run_id
          ? activeSubagents.get(event.run_id)
          : undefined;
        if (subagent && event.run_id) {
          activeSubagents.delete(event.run_id);
          usedAgents.add(subagent);
          yield { type: "progress", agent: subagent, status: "completed" };
        }
        continue;
      }

      if (event.event === "on_chain_error") {
        const subagent = event.run_id
          ? activeSubagents.get(event.run_id)
          : undefined;
        if (subagent && event.run_id) {
          activeSubagents.delete(event.run_id);
          yield {
            type: "progress",
            agent: subagent,
            status: "failed",
            message: "子代理执行失败",
          };
        }
        continue;
      }

      if (event.event === "on_tool_start") {
        const namespace = checkpointNamespace(event);
        const agentName = ownerForNamespace(
          namespace,
          namespaceOwners,
        );
        const toolName = event.name || "unknown";
        toolCalls.push(toolName);
        if (event.run_id) {
          activeTools.set(event.run_id, { agent: agentName, name: toolName });
        }
        if (toolName === "task") {
          const requestedAgent = parseToolInput(event).subagent_type;
          if (
            typeof requestedAgent === "string" &&
            isRequirementSubagent(requestedAgent)
          ) {
            if (namespace) namespaceOwners.set(namespace, requestedAgent);
          }
        }
        yield {
          type: "progress",
          agent: agentName,
          tool: toolName,
          status: "started",
        };
        continue;
      }

      if (event.event === "on_tool_end" || event.event === "on_tool_error") {
        const active = event.run_id ? activeTools.get(event.run_id) : undefined;
        if (event.run_id) activeTools.delete(event.run_id);
        const agentName =
          active?.agent ??
          ownerForNamespace(checkpointNamespace(event), namespaceOwners);
        const toolName = active?.name ?? event.name ?? "unknown";
        const failed = event.event === "on_tool_error";
        yield {
          type: "progress",
          agent: agentName,
          tool: toolName,
          status: failed ? "failed" : "completed",
          ...(failed ? { message: "工具执行失败" } : {}),
        };
      }
    }
  } catch (error) {
    for (const subagent of new Set(activeSubagents.values())) {
      yield {
        type: "progress",
        agent: subagent,
        status: "failed",
        message: "子代理执行失败",
      };
    }
    yield {
      type: "progress",
      agent: PUBLIC_COORDINATOR_NAME,
      status: "failed",
      message: "协调器执行失败",
    };
    throw error;
  }

  if (!finalState) {
    yield {
      type: "progress",
      agent: PUBLIC_COORDINATOR_NAME,
      status: "failed",
      message: "最终状态校验失败",
    };
    throw new Error("DeepAgent 运行结束但未返回最终状态");
  }

  let result: Extract<RuntimeEvent, { type: "final" }>;
  try {
    result = projectResult(finalState, usedAgents, toolCalls);
  } catch (error) {
    yield {
      type: "progress",
      agent: PUBLIC_COORDINATOR_NAME,
      status: "failed",
      message: "产物校验失败",
    };
    throw error;
  }

  yield {
    type: "progress",
    agent: PUBLIC_COORDINATOR_NAME,
    status: "completed",
  };
  for (const [path, content] of Object.entries(result.artifacts)) {
    yield { type: "artifact", path, content };
  }
  yield result;
}

@Injectable()
export class DeepAgentRuntime implements AgentRuntime {
  async *stream(
    input: string,
    context: RuntimeContext,
  ): AsyncGenerator<RuntimeEvent> {
    yield* streamRequirementWithModel(
      createConfiguredModel(),
      input,
      context,
    );
  }
}
