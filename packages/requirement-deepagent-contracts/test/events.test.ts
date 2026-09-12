import { describe, expect, it } from "bun:test";
import { isAgentStreamEvent } from "../src";

describe("MVP-2 stream contracts", () => {
  it("recognizes clarification and paused envelopes", () => {
    const envelope = {
      runId: "run-1",
      threadId: "thread-1",
      sequence: 2,
      timestamp: new Date(0).toISOString(),
    };

    expect(
      isAgentStreamEvent({
        ...envelope,
        type: "clarification.required",
        assessment: {
          complete: false,
          score: 0.4,
          missingFields: ["scope_limit"],
          reason: "缺少处理上限",
        },
        questions: [],
      }),
    ).toBe(true);
    expect(
      isAgentStreamEvent({
        ...envelope,
        sequence: 3,
        type: "run.paused",
        status: "waiting",
      }),
    ).toBe(true);
  });
});
