import { describe, expect, it } from "bun:test";
import type {
  RequirementArtifact,
  RequirementTodo,
} from "@autix/requirement-deepagent-contracts";
import { AgentService } from "../src/agent/agent.service";
import type {
  RequirementRuntime,
  RequirementRuntimeEvent,
} from "../src/agent/runtime/runtime.types";

const todos: RequirementTodo[] = [
  { content: "委派需求专家", status: "completed" },
  { content: "整理报告", status: "completed" },
  { content: "确认交付", status: "completed" },
];
const artifact: RequirementArtifact = {
  path: "/work/final-report.md",
  mediaType: "text/markdown",
  content: "# 需求摘要\n\n完成",
  sizeChars: 12,
  virtual: true,
};
const runtimeConfig = {
  modelTimeoutMs: 120_000,
  runTimeoutMs: 300_000,
  recursionLimit: 60,
};

function runtimeFrom(events: RequirementRuntimeEvent[]): RequirementRuntime {
  return {
    async *stream() {
      yield* events;
    },
  };
}

async function collect(service: AgentService, signal?: AbortSignal) {
  const events = [];
  for await (const event of service.stream(
    { input: "分析批量导入需求", threadId: "thread-test" },
    signal,
  )) {
    events.push(event);
  }
  return events;
}

describe("AgentService event lifecycle", () => {
  it("emits exactly one start and one terminal event in order", async () => {
    const service = new AgentService(
      runtimeFrom([
        {
          type: "agent.progress",
          agent: "requirement-coordinator",
          status: "started",
        },
        { type: "plan.updated", todos },
        { type: "artifact.available", artifact },
        {
          type: "report.completed",
          report: artifact.content,
          artifacts: [artifact],
          todos,
          usedAgents: ["requirement-coordinator", "requirement-analyst"],
        },
      ]),
      runtimeConfig,
    );

    const events = await collect(service);
    expect(events.filter((event) => event.type === "run.started")).toHaveLength(1);
    expect(events.filter((event) => event.type === "run.done")).toHaveLength(1);
    expect(events[0]?.type).toBe("run.started");
    expect(events.at(-1)).toMatchObject({ type: "run.done", status: "completed" });
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("stops before runtime output when the caller cancels", async () => {
    let runtimeCalls = 0;
    const runtime: RequirementRuntime = {
      async *stream() {
        runtimeCalls += 1;
        yield { type: "plan.updated", todos };
      },
    };
    const service = new AgentService(runtime, runtimeConfig);
    const controller = new AbortController();
    const iterator = service.stream(
      { input: "分析需求", threadId: "thread-cancel" },
      controller.signal,
    );

    expect((await iterator.next()).value?.type).toBe("run.started");
    controller.abort();
    const remaining = [];
    for await (const event of iterator) remaining.push(event);

    expect(runtimeCalls).toBe(0);
    expect(remaining.map((event) => event.type)).toEqual([
      "run.cancelled",
      "run.done",
    ]);
    expect(remaining.at(-1)).toMatchObject({ status: "cancelled" });
  });

  it("converts runtime failures to public events", async () => {
    const runtime: RequirementRuntime = {
      async *stream(): AsyncGenerator<RequirementRuntimeEvent> {
        throw new Error("provider leaked a private detail");
      },
    };
    const events = await collect(new AgentService(runtime, runtimeConfig));

    expect(events.find((event) => event.type === "run.error")).toMatchObject({
      code: "AGENT_RUN_FAILED",
    });
    expect(events.at(-1)).toMatchObject({ type: "run.done", status: "failed" });
    expect(JSON.stringify(events)).not.toContain("private detail");
  });
});
