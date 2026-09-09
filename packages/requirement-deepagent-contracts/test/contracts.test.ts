import { describe, expect, it } from "bun:test";
import {
  isAgentStreamEvent,
  isModelDiagnosticResponse,
  type AgentStreamEvent,
  type ModelDiagnosticResponse,
} from "../src";

describe("requirement DeepAgent contracts", () => {
  it("accepts a complete model diagnostic response", () => {
    const response: ModelDiagnosticResponse = {
      service: "requirement-deepagent-api",
      status: "ready",
      configuration: {
        model: "tool-capable-model",
        apiKeyConfigured: true,
        baseUrlConfigured: false,
      },
      toolCalling: {
        supported: true,
        probeToolName: "mvp0_capability_probe",
      },
      latencyMs: 12,
      timestamp: new Date(0).toISOString(),
    };

    expect(isModelDiagnosticResponse(response)).toBe(true);
  });

  it("rejects an incomplete response", () => {
    expect(isModelDiagnosticResponse({ status: "ready" })).toBe(false);
  });

  it("accepts an enveloped business stream event", () => {
    const event: AgentStreamEvent = {
      type: "run.done",
      status: "completed",
      runId: "run-1",
      threadId: "thread-1",
      sequence: 7,
      timestamp: new Date(0).toISOString(),
    };

    expect(isAgentStreamEvent(event)).toBe(true);
    expect(isAgentStreamEvent({ type: "run.done" })).toBe(false);
  });
});
