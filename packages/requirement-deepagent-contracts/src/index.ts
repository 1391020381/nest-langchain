export type ServiceState = "alive" | "ready" | "not_ready";

export interface LiveHealthResponse {
  service: "requirement-deepagent-api";
  status: "alive";
  timestamp: string;
}

export interface ReadinessCheck {
  status: "pass" | "fail";
  message: string;
}

export interface ReadinessResponse {
  service: "requirement-deepagent-api";
  status: "ready" | "not_ready";
  checks: {
    modelConfiguration: ReadinessCheck;
  };
  timestamp: string;
}

export interface PublicModelConfiguration {
  model: string;
  apiKeyConfigured: boolean;
  baseUrlConfigured: boolean;
}

export type ModelDiagnosticFailureCode =
  | "MODEL_NOT_CONFIGURED"
  | "AUTHENTICATION_FAILED"
  | "MODEL_NOT_FOUND"
  | "TOOL_CALLING_UNSUPPORTED"
  | "PROVIDER_REJECTED_REQUEST"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "UNKNOWN_PROVIDER_ERROR";

interface ModelDiagnosticBase {
  service: "requirement-deepagent-api";
  configuration: PublicModelConfiguration;
  latencyMs: number;
  timestamp: string;
}

export interface ModelDiagnosticSuccess extends ModelDiagnosticBase {
  status: "ready";
  toolCalling: {
    supported: true;
    probeToolName: string;
  };
}

export interface ModelDiagnosticFailure extends ModelDiagnosticBase {
  status: "failed";
  toolCalling: {
    supported: false;
  };
  error: {
    code: ModelDiagnosticFailureCode;
    message: string;
  };
}

export type ModelDiagnosticResponse =
  | ModelDiagnosticSuccess
  | ModelDiagnosticFailure;

export function isModelDiagnosticResponse(
  value: unknown,
): value is ModelDiagnosticResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.service === "requirement-deepagent-api" &&
    (candidate.status === "ready" || candidate.status === "failed") &&
    typeof candidate.latencyMs === "number" &&
    typeof candidate.timestamp === "string" &&
    typeof candidate.configuration === "object" &&
    typeof candidate.toolCalling === "object"
  );
}

export const REQUIREMENT_INPUT_MAX_CHARS = 20_000;

export interface AgentRunRequest {
  input: string;
  threadId?: string;
}

export interface CompletenessAssessment {
  complete: false;
  score: number;
  missingFields: string[];
  reason: string;
}

export interface ClarificationQuestion {
  id: string;
  field:
    | "actor"
    | "goal"
    | "input_format"
    | "scope_limit"
    | "failure_handling"
    | "permission"
    | "audit"
    | "acceptance"
    | "other";
  label: string;
  prompt: string;
  required: boolean;
  placeholder?: string;
}

export interface ClarificationAnswer {
  questionId: string;
  value: string;
}

export interface AgentResumeRequest {
  threadId: string;
  requestId: string;
  answers: ClarificationAnswer[];
}

export interface AgentCancelRequest {
  threadId: string;
}

export type AgentRunStatus = "completed" | "failed" | "cancelled";
export type AgentProgressStatus = "started" | "completed" | "failed";
export type ToolProgressStatus = "started" | "completed" | "failed";
export type RequirementAgentName =
  | "requirement-coordinator"
  | "requirement-analyst";

export interface RequirementTodo {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface RequirementArtifact {
  path: string;
  mediaType: "text/markdown" | "text/plain";
  content: string;
  sizeChars: number;
  /** `/work` belongs to DeepAgent StateBackend, not the host filesystem. */
  virtual: true;
}

interface AgentStreamEnvelope {
  runId: string;
  threadId: string;
  sequence: number;
  timestamp: string;
}

export type AgentStreamEvent =
  | (AgentStreamEnvelope & {
      type: "run.started";
      inputChars: number;
    })
  | (AgentStreamEnvelope & {
      type: "plan.updated";
      todos: RequirementTodo[];
    })
  | (AgentStreamEnvelope & {
      type: "agent.progress";
      agent: RequirementAgentName;
      status: AgentProgressStatus;
      message?: string;
    })
  | (AgentStreamEnvelope & {
      type: "tool.progress";
      agent: RequirementAgentName;
      tool: string;
      status: ToolProgressStatus;
      message?: string;
    })
  | (AgentStreamEnvelope & {
      type: "artifact.available";
      artifact: RequirementArtifact;
    })
  | (AgentStreamEnvelope & {
      type: "report.completed";
      report: string;
      artifacts: RequirementArtifact[];
      todos: RequirementTodo[];
      usedAgents: RequirementAgentName[];
    })
  | (AgentStreamEnvelope & {
      type: "clarification.required";
      assessment: CompletenessAssessment;
      questions: ClarificationQuestion[];
    })
  | (AgentStreamEnvelope & {
      type: "run.paused";
      status: "waiting";
    })
  | (AgentStreamEnvelope & {
      type: "run.resumed";
      answerCount: number;
    })
  | (AgentStreamEnvelope & {
      type: "run.error";
      code:
        | "MODEL_NOT_CONFIGURED"
        | "AGENT_TIMEOUT"
        | "AGENT_OUTPUT_INVALID"
        | "AGENT_RUN_FAILED";
      message: string;
    })
  | (AgentStreamEnvelope & {
      type: "run.cancelled";
      message: string;
    })
  | (AgentStreamEnvelope & {
      type: "run.done";
      status: AgentRunStatus;
    });

export interface AgentCancelResponse {
  runId: string;
  threadId: string;
  status: "cancelled";
  events: AgentStreamEvent[];
}

export function isAgentStreamEvent(value: unknown): value is AgentStreamEvent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.type === "string" &&
    typeof candidate.runId === "string" &&
    typeof candidate.threadId === "string" &&
    typeof candidate.sequence === "number" &&
    typeof candidate.timestamp === "string"
  );
}
