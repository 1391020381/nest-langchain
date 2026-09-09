import type {
  AgentProgressStatus,
  RequirementAgentName,
  RequirementArtifact,
  RequirementTodo,
  ToolProgressStatus,
} from "@autix/requirement-deepagent-contracts";

export interface RuntimeRunOptions {
  runId: string;
  threadId: string;
  signal: AbortSignal;
  recursionLimit: number;
}

export type RequirementRuntimeEvent =
  | {
      type: "plan.updated";
      todos: RequirementTodo[];
    }
  | {
      type: "agent.progress";
      agent: RequirementAgentName;
      status: AgentProgressStatus;
      message?: string;
    }
  | {
      type: "tool.progress";
      agent: RequirementAgentName;
      tool: string;
      status: ToolProgressStatus;
      message?: string;
    }
  | {
      type: "artifact.available";
      artifact: RequirementArtifact;
    }
  | {
      type: "report.completed";
      report: string;
      artifacts: RequirementArtifact[];
      todos: RequirementTodo[];
      usedAgents: RequirementAgentName[];
    };

export interface RequirementRuntime {
  stream(
    input: string,
    options: RuntimeRunOptions,
  ): AsyncGenerator<RequirementRuntimeEvent>;
}

export const REQUIREMENT_RUNTIME = Symbol("REQUIREMENT_RUNTIME");
export const REQUIREMENT_RUNTIME_CONFIG = Symbol("REQUIREMENT_RUNTIME_CONFIG");
