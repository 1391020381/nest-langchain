import { describe, expect, test } from "bun:test";
import type {
  AgentRunRequest,
  AgentStreamEvent,
} from "@autix/deepagent-contracts";
import { AgentService } from "../src/agent/agent.service";
import type {
  AgentRuntime,
  RuntimeContext,
  RuntimeEvent,
} from "../src/agent/types";

async function collect(
  stream: AsyncGenerator<AgentStreamEvent>,
): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

class FakeRuntime implements AgentRuntime {
  calls: Array<{ input: string; context: RuntimeContext }> = [];

  constructor(
    private readonly events: RuntimeEvent[],
    private readonly failure?: Error,
  ) {}

  async *stream(
    input: string,
    context: RuntimeContext,
  ): AsyncGenerator<RuntimeEvent> {
    this.calls.push({ input, context });
    for (const event of this.events) yield event;
    if (this.failure) throw this.failure;
  }
}

const finalEvent: Extract<RuntimeEvent, { type: "final" }> = {
  type: "final",
  report: "# 分析报告",
  todos: [{ content: "完成分析", status: "completed" }],
  artifacts: { "/work/final-report.md": "# 分析报告" },
  usedAgents: ["requirement-analyst"],
  toolCalls: ["write_todos", "task", "write_file"],
};

describe("AgentService stream envelope", () => {
  test("an injected runtime is wrapped in strict start-to-done order", async () => {
    const runtime = new FakeRuntime([
      {
        type: "progress",
        agent: "coordinator",
        status: "started",
      },
      {
        type: "progress",
        agent: "requirement-analyst",
        tool: "analyze_completeness",
        status: "completed",
      },
      {
        type: "artifact",
        path: "/work/final-report.md",
        content: "# 分析报告",
      },
      finalEvent,
    ]);
    const service = new AgentService(runtime);
    const cancellation = new AbortController();

    const events = await collect(
      service.stream(
        { input: "分析批量导入需求", threadId: "thread-1" },
        cancellation.signal,
      ),
    );

    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "progress",
      "progress",
      "artifact",
      "final",
      "done",
    ]);
    expect(runtime.calls).toHaveLength(1);
    expect(runtime.calls[0].input).toBe("分析批量导入需求");
    expect(runtime.calls[0].context.threadId).toBe("thread-1");
    expect(runtime.calls[0].context.signal).toBe(cancellation.signal);

    const runId = events[0].runId;
    expect(runId.length).toBeGreaterThan(0);
    expect(runtime.calls[0].context.runId).toBe(runId);
    for (const event of events) {
      expect(event.runId).toBe(runId);
      expect(event.threadId).toBe("thread-1");
      expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);
    }
    expect(events.at(-2)).toMatchObject(finalEvent);
  });

  test("an already-cancelled client does not start the model runtime", async () => {
    const runtime = new FakeRuntime([finalEvent]);
    const service = new AgentService(runtime);
    const cancellation = new AbortController();
    cancellation.abort();

    const events = await collect(
      service.stream({ input: "不会开始", threadId: "cancelled" }, cancellation.signal),
    );

    expect(events.map((event) => event.type)).toEqual(["run.started"]);
    expect(runtime.calls).toEqual([]);
  });

  test("the service creates one thread id when the caller omits it", async () => {
    const runtime = new FakeRuntime([finalEvent]);
    const service = new AgentService(runtime);
    const request: AgentRunRequest = { input: "分析登录需求" };

    const events = await collect(service.stream(request));
    const threadIds = new Set(events.map((event) => event.threadId));

    expect(threadIds.size).toBe(1);
    expect(events[0].threadId.length).toBeGreaterThan(0);
    expect(runtime.calls[0].context.threadId).toBe(events[0].threadId);
  });

  test("runtime failure produces one error terminal followed by done", async () => {
    const runtime = new FakeRuntime(
      [
        {
          type: "progress",
          agent: "coordinator",
          status: "started",
        },
      ],
      new Error("model unavailable"),
    );
    const service = new AgentService(runtime);

    const events = await collect(
      service.stream({ input: "分析需求", threadId: "thread-error" }),
    );

    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "progress",
      "error",
      "done",
    ]);
    expect(events.some((event) => event.type === "final")).toBe(false);
    expect(events[2]).toMatchObject({
      type: "error",
      code: "AGENT_RUN_FAILED",
      message:
        "DeepAgent 运行失败。请检查模型配置，或使用 runId 查看服务日志。",
    });
    expect(events[3].runId).toBe(events[0].runId);
    expect(events[3].threadId).toBe("thread-error");
  });
});
