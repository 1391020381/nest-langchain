import type { createRequirementTools } from "./tools/requirement.tools";

export type ReturnTypeOfRequirementTools = ReturnType<
  typeof createRequirementTools
>;

export type RuntimeContext = {
  runId: string;
  threadId: string;
  signal?: AbortSignal;
};

export type RuntimeEvent =
  | {
      type: "progress";
      agent: string;
      tool?: string;
      status: "started" | "completed" | "failed";
      message?: string;
    }
  | { type: "artifact"; path: string; content: string }
  | {
      type: "final";
      report: string;
      todos: Array<{
        content: string;
        status: "pending" | "in_progress" | "completed";
      }>;
      artifacts: Record<string, string>;
      usedAgents: string[];
      toolCalls: string[];
    };

export interface AgentRuntime {
  stream(input: string, context: RuntimeContext): AsyncGenerator<RuntimeEvent>;
}
