import { describe, expect, it } from "bun:test";
import type {
  ClarificationAnswer,
  ClarificationQuestion,
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
const questions: ClarificationQuestion[] = [
  {
    id: "max_rows",
    field: "scope_limit",
    label: "单次数据上限",
    prompt: "单次最多允许导入多少行？",
    required: true,
    placeholder: "例如：10,000 行",
  },
];
const clarificationEvent: RequirementRuntimeEvent = {
  type: "clarification.required",
  assessment: {
    complete: false,
    score: 0.4,
    missingFields: ["scope_limit"],
    reason: "缺少会影响方案和验收的处理上限。",
  },
  questions,
};

function runtimeFrom(events: RequirementRuntimeEvent[]): RequirementRuntime {
  return {
    async *stream() {
      yield* events;
    },
    async *resume() {
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

async function collectResume(
  service: AgentService,
  runId: string,
  answers: ClarificationAnswer[],
  requestId = "resume-request-1",
) {
  const events = [];
  for await (const event of service.resume(runId, {
    threadId: "thread-test",
    requestId,
    answers,
  })) {
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
      async *resume() {},
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
      async *resume() {},
    };
    const events = await collect(new AgentService(runtime, runtimeConfig));

    expect(events.find((event) => event.type === "run.error")).toMatchObject({
      code: "AGENT_RUN_FAILED",
    });
    expect(events.at(-1)).toMatchObject({ type: "run.done", status: "failed" });
    expect(JSON.stringify(events)).not.toContain("private detail");
  });

  it("pauses without a report and resumes the same run after clarification", async () => {
    let resumeCalls = 0;
    const runtime: RequirementRuntime = {
      async *stream() {
        yield clarificationEvent;
      },
      async *resume(answers) {
        resumeCalls += 1;
        expect(answers).toEqual([
          { questionId: "max_rows", value: "最多 10,000 行" },
        ]);
        yield {
          type: "report.completed",
          report: `${artifact.content}\n\n上限：最多 10,000 行`,
          artifacts: [artifact],
          todos,
          usedAgents: ["requirement-coordinator", "requirement-analyst"],
        };
      },
    };
    const service = new AgentService(runtime, runtimeConfig);
    const initial = await collect(service);
    const runId = initial[0]!.runId;

    expect(initial.map((event) => event.type)).toEqual([
      "run.started",
      "clarification.required",
      "run.paused",
    ]);
    expect(initial.some((event) => event.type === "report.completed")).toBe(false);
    expect(initial.some((event) => event.type === "run.done")).toBe(false);

    const resumed = await collectResume(service, runId, [
      { questionId: "max_rows", value: "最多 10,000 行" },
    ]);
    expect(resumeCalls).toBe(1);
    expect(resumed.map((event) => event.type)).toEqual([
      "run.resumed",
      "report.completed",
      "run.done",
    ]);
    expect(resumed.every((event) => event.runId === runId)).toBe(true);
    expect(resumed.every((event) => event.threadId === "thread-test")).toBe(true);
    expect([...initial, ...resumed].map((event) => event.sequence)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(() =>
      service.validateResumeRequest(runId, {
        threadId: "thread-test",
        requestId: "resume-request-1",
        answers: [{ questionId: "max_rows", value: "最多 10,000 行" }],
      }),
    ).toThrow("已经处理");
    expect(resumeCalls).toBe(1);
  });

  it("rejects missing required answers before resuming the runtime", async () => {
    const service = new AgentService(runtimeFrom([clarificationEvent]), runtimeConfig);
    const initial = await collect(service);
    const runId = initial[0]!.runId;

    expect(() =>
      service.validateResumeRequest(runId, {
        threadId: "thread-test",
        requestId: "resume-invalid",
        answers: [],
      }),
    ).toThrow("请回答必填问题");
  });

  it("cancels a waiting run idempotently", async () => {
    const service = new AgentService(runtimeFrom([clarificationEvent]), runtimeConfig);
    const initial = await collect(service);
    const runId = initial[0]!.runId;
    const first = service.cancel(runId, { threadId: "thread-test" });
    const repeated = service.cancel(runId, { threadId: "thread-test" });

    expect(first.events.map((event) => event.type)).toEqual([
      "run.cancelled",
      "run.done",
    ]);
    expect(first.events.at(-1)).toMatchObject({ status: "cancelled" });
    expect(repeated.events).toEqual(first.events);
  });
});
