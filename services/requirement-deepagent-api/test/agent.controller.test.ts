import { describe, expect, it } from "bun:test";
import type { AgentStreamEvent } from "@autix/requirement-deepagent-contracts";
import { formatSseEvent } from "../src/agent/agent.controller";

describe("Agent SSE transport", () => {
  it("frames one business event as one SSE message", () => {
    const event: AgentStreamEvent = {
      type: "run.done",
      status: "completed",
      runId: "run-1",
      threadId: "thread-1",
      sequence: 2,
      timestamp: new Date(0).toISOString(),
    };

    const payload = formatSseEvent(event);
    expect(payload.startsWith("event: run.done\ndata: ")).toBe(true);
    expect(payload.endsWith("\n\n")).toBe(true);
    expect(JSON.parse(payload.split("data: ")[1]!.trim())).toEqual(event);
  });
});
