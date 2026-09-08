import { afterEach, describe, expect, test } from "bun:test";
import { streamAgentRun } from "./agent-api";

const originalFetch = globalThis.fetch;
const envelope = {
  runId: "run-web-test",
  threadId: "thread-web-test",
  timestamp: "2026-09-07T00:00:00.000Z",
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function sseFrame(event, lineEnding = "\n") {
  return `data: ${JSON.stringify(event)}${lineEnding}${lineEnding}`;
}

function streamingResponse(chunks, cancellations) {
  const encoder = new TextEncoder();
  let index = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      }
    },
    cancel(reason) {
      cancellations.push(reason);
    },
  });

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function mockStream(chunks) {
  const cancellations = [];
  globalThis.fetch = async () => streamingResponse(chunks, cancellations);
  return cancellations;
}

describe("DeepAgent Web SSE client", () => {
  test("uses the same-origin Next proxy by default", async () => {
    const cancellations = [];
    const done = { type: "done", ...envelope };
    let requestedUrl = "";
    globalThis.fetch = async (input) => {
      requestedUrl = String(input);
      return streamingResponse([sseFrame(done)], cancellations);
    };

    await streamAgentRun(
      { input: "验证同源代理", threadId: envelope.threadId },
      { onEvent: () => undefined },
    );

    expect(requestedUrl).toBe("/api/agent/runs/stream");
    expect(cancellations).toHaveLength(1);
  });

  test("recognizes CRLF frame boundaries split across network chunks", async () => {
    const started = { type: "run.started", ...envelope };
    const done = { type: "done", ...envelope };
    const startedJson = JSON.stringify(started);
    const doneJson = JSON.stringify(done);
    const cancellations = mockStream([
      `data: ${startedJson}\r`,
      "\n\r",
      `\ndata: ${doneJson}\r\n\r`,
      "\n",
    ]);
    const received = [];

    await streamAgentRun(
      { input: "验证 CRLF 分块", threadId: envelope.threadId },
      { onEvent: (event) => received.push(event) },
    );

    expect(received.map((event) => event.type)).toEqual([
      "run.started",
      "done",
    ]);
    expect(cancellations).toHaveLength(1);
  });

  for (const [name, frame, expectedMessage] of [
    [
      "cancels the response when JSON is malformed",
      "data: {not-json}\n\n",
      "服务返回了无法解析的流式数据",
    ],
    [
      "cancels the response when an event violates the shared schema",
      sseFrame({
        type: "progress",
        ...envelope,
        agent: "coordinator",
        status: "unknown",
      }),
      "服务返回了不符合约定的事件",
    ],
  ]) {
    test(name, async () => {
      const cancellations = mockStream([frame]);
      const received = [];

      await expect(
        streamAgentRun(
          { input: "验证错误收口", threadId: envelope.threadId },
          { onEvent: (event) => received.push(event) },
        ),
      ).rejects.toThrow(expectedMessage);

      expect(received).toEqual([]);
      expect(cancellations).toHaveLength(1);
      expect(cancellations[0]).toBeInstanceOf(Error);
    });
  }

  test("done cancels immediately and ignores every trailing frame", async () => {
    const done = { type: "done", ...envelope };
    const trailing = {
      type: "progress",
      ...envelope,
      agent: "coordinator",
      status: "completed",
    };
    const cancellations = mockStream([sseFrame(done) + sseFrame(trailing)]);
    const received = [];

    await streamAgentRun(
      { input: "验证 done 终止", threadId: envelope.threadId },
      { onEvent: (event) => received.push(event) },
    );

    expect(received.map((event) => event.type)).toEqual(["done"]);
    expect(cancellations).toHaveLength(1);
    expect(cancellations[0]).toBeUndefined();
  });
});
