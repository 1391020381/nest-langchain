import { fakeModel } from "@langchain/core/testing";
import { streamRequirementWithModel } from "../../src/agent/deepagent.runtime";

const model = fakeModel().respondWithTools([
  {
    name: "task",
    args: {
      subagent_type: "requirement-analyst",
      description: "触发一个可预期的离线子 Agent 失败",
    },
    id: "task-failure-probe",
  },
]);

const eventTypes: string[] = [];
let streamError: unknown;

try {
  for await (const event of streamRequirementWithModel(
    model,
    "验证子 Agent 失败不会产生未处理 Promise 拒绝",
    { runId: "failure-probe", threadId: "failure-probe-thread" },
  )) {
    eventTypes.push(event.type);
  }
} catch (error) {
  streamError = error;
}

if (streamError === undefined) {
  console.error("PROBE_ERROR:expected the incomplete fake model run to fail");
  process.exitCode = 2;
} else {
  const message =
    streamError instanceof Error ? streamError.message : String(streamError);
  console.log(`EXPECTED_STREAM_ERROR:${message}`);
}
console.log(`EVENT_TYPES:${eventTypes.join(",")}`);

// Give Bun one event-loop turn to surface any rejected stream projection Promise.
// A correct adapter reaches this marker and exits 0; an unhandled rejection exits 1.
await new Promise<void>((resolve) => setTimeout(resolve, 0));
console.log("PROBE_COMPLETED");
