import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AgentStreamEventSchema,
  type AgentRunRequest,
  type AgentStreamEvent,
} from "@autix/deepagent-contracts";
/*
 * AgentStreamEventSchema is deliberately evaluated at the HTTP boundary:
 * TypeScript protects our source, while Zod also protects runtime adapters.
 */
import type {
  AgentRuntime,
  RuntimeEvent,
} from "./types";
import { randomUUID } from "node:crypto";
import { AGENT_RUNTIME } from "./agent.tokens";

function publicErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("OPENAI_API_KEY 未配置。")) return message;
  if (
    message.includes("GRAPH_RECURSION_LIMIT") ||
    message.includes("Recursion limit of")
  ) {
    return "DeepAgent 未能在步骤上限内结束，模型可能陷入了重复工具调用。请使用 runId 查看服务日志。";
  }
  return "DeepAgent 运行失败。请检查模型配置，或使用 runId 查看服务日志。";
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly logProgress = process.env.DEEPAGENT_LOG_PROGRESS !== "0";

  constructor(
    @Inject(AGENT_RUNTIME) private readonly runtime: AgentRuntime,
  ) {}

  async *stream(
    request: AgentRunRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<AgentStreamEvent> {
    const runId = randomUUID();
    const threadId = request.threadId ?? randomUUID();
    const envelope = () => ({
      runId,
      threadId,
      timestamp: new Date().toISOString(),
    });

    this.log(runId, `started thread=${threadId} inputChars=${request.input.length}`);
    yield { type: "run.started", ...envelope() };
    if (signal?.aborted) {
      this.log(runId, "cancelled before runtime start");
      return;
    }

    try {
      for await (const event of this.runtime.stream(request.input, {
        runId,
        threadId,
        signal,
      })) {
        if (signal?.aborted) {
          this.log(runId, "cancelled by client");
          return;
        }
        this.logRuntimeEvent(runId, event);
        yield this.toPublicEvent(event, envelope());
      }
    } catch (error) {
      if (signal?.aborted) return;
      this.logger.error(
        `DeepAgent run ${runId} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      yield {
        type: "error",
        code: "AGENT_RUN_FAILED",
        message: publicErrorMessage(error),
        ...envelope(),
      };
    }

    this.log(runId, "done");
    yield { type: "done", ...envelope() };
  }

  private log(runId: string, message: string): void {
    if (this.logProgress) this.logger.log(`[run:${runId}] ${message}`);
  }

  private logRuntimeEvent(runId: string, event: RuntimeEvent): void {
    if (event.type === "progress") {
      const tool = event.tool ? ` tool=${event.tool}` : "";
      const message = event.message ? ` message=${event.message}` : "";
      this.log(
        runId,
        `progress agent=${event.agent}${tool} status=${event.status}${message}`,
      );
      return;
    }
    if (event.type === "artifact") {
      this.log(runId, `artifact path=${event.path} chars=${event.content.length}`);
      return;
    }
    this.log(
      runId,
      `final agents=${event.usedAgents.length} todos=${event.todos.length} artifacts=${Object.keys(event.artifacts).length} toolCalls=${event.toolCalls.length}`,
    );
  }

  private toPublicEvent(
    event: RuntimeEvent,
    envelope: { runId: string; threadId: string; timestamp: string },
  ): AgentStreamEvent {
    return AgentStreamEventSchema.parse({ ...event, ...envelope });
  }
}
