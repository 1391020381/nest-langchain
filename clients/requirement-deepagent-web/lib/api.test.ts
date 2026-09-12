import { describe, expect, it } from "bun:test";
import { formatApiError, SseEventDecoder } from "./api";

describe("diagnostic API client", () => {
  it("keeps actionable Error messages", () => {
    expect(formatApiError(new Error("API 未启动"))).toBe("API 未启动");
  });

  it("provides a stable fallback for unknown failures", () => {
    expect(formatApiError({ reason: "unknown" })).toContain("4200");
  });

  it("decodes fragmented SSE business events and ignores heartbeats", () => {
    const decoder = new SseEventDecoder();
    const json = JSON.stringify({
      type: "run.done",
      status: "completed",
      runId: "run-1",
      threadId: "thread-1",
      sequence: 3,
      timestamp: new Date(0).toISOString(),
    });

    expect(decoder.push(": keepalive\n\n")).toEqual([]);
    expect(decoder.push(`event: run.done\ndata: ${json.slice(0, 25)}`)).toEqual(
      [],
    );
    expect(decoder.push(`${json.slice(25)}\n\n`)).toEqual([
      expect.objectContaining({ type: "run.done", status: "completed" }),
    ]);
  });

  it("decodes the waiting boundary used before a clarification resume", () => {
    const decoder = new SseEventDecoder();
    const event = {
      type: "run.paused",
      status: "waiting",
      runId: "run-clarification",
      threadId: "thread-clarification",
      sequence: 4,
      timestamp: new Date(0).toISOString(),
    };

    expect(
      decoder.push(`event: run.paused\ndata: ${JSON.stringify(event)}\n\n`),
    ).toEqual([event]);
  });
});
