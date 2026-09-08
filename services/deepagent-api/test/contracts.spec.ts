import { describe, expect, test } from "bun:test";
import {
  AgentRunRequestSchema,
  AgentStreamEventSchema,
  encodeSseEvent,
  type AgentStreamEvent,
} from "@autix/deepagent-contracts";

const envelope = {
  runId: "run-1",
  threadId: "thread-1",
  timestamp: "2026-09-07T00:00:00.000Z",
};

describe("shared DeepAgent stream contract", () => {
  test("request parsing trims input and accepts a caller thread id", () => {
    expect(
      AgentRunRequestSchema.parse({
        input: "  分析批量导入需求  ",
        threadId: "thread-1",
      }),
    ).toEqual({ input: "分析批量导入需求", threadId: "thread-1" });
  });

  test("request parsing rejects blank and oversized input", () => {
    expect(() => AgentRunRequestSchema.parse({ input: "   " })).toThrow();
    expect(() =>
      AgentRunRequestSchema.parse({ input: "x".repeat(20_001) }),
    ).toThrow();
  });

  test("all public event variants pass the discriminated union", () => {
    const events: AgentStreamEvent[] = [
      { ...envelope, type: "run.started" },
      {
        ...envelope,
        type: "progress",
        agent: "coordinator",
        tool: "write_todos",
        status: "started",
      },
      {
        ...envelope,
        type: "progress",
        agent: "coordinator",
        tool: "write_file",
        status: "failed",
        message: "write denied",
      },
      {
        ...envelope,
        type: "artifact",
        path: "/work/final-report.md",
        content: "# report",
      },
      {
        ...envelope,
        type: "final",
        report: "# report",
        todos: [{ content: "分析", status: "completed" }],
        artifacts: { "/work/final-report.md": "# report" },
        usedAgents: ["requirement-analyst"],
        toolCalls: ["write_todos", "task", "write_file"],
      },
      { ...envelope, type: "error", code: "AGENT_FAILED", message: "boom" },
      { ...envelope, type: "done" },
    ];

    for (const event of events) {
      expect(AgentStreamEventSchema.parse(event)).toEqual(event);
    }
  });

  test("invalid progress status is rejected at the shared boundary", () => {
    expect(() =>
      AgentStreamEventSchema.parse({
        ...envelope,
        type: "progress",
        agent: "coordinator",
        status: "running",
      }),
    ).toThrow();
  });

  test("SSE encoding survives Chinese text and embedded newlines", () => {
    const event: AgentStreamEvent = {
      ...envelope,
      type: "artifact",
      path: "/work/final-report.md",
      content: "# 报告\n第二行",
    };
    const encoded = encodeSseEvent(event);

    expect(encoded.startsWith("data: ")).toBe(true);
    expect(encoded.endsWith("\n\n")).toBe(true);
    expect(JSON.parse(encoded.slice(6, -2))).toEqual(event);
  });
});
