import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";

import { createObservedWeatherAgent } from "./agent";
import { createHarnessObserver, readFileText } from "./observer";

describe("DeepAgent Harness 观察器", () => {
  test("能够使用 Fake Model 组装 DeepAgent Harness", () => {
    const agent = createObservedWeatherAgent(fakeModel());
    assert.equal(typeof agent.invoke, "function");
    assert.equal(typeof agent.stream, "function");
  });

  test("只打印新增 Message，并跟踪 Todo 与虚拟文件", () => {
    const logs: string[] = [];
    const observer = createHarnessObserver((text) => logs.push(text));
    const human = new HumanMessage("查询杭州天气");
    const ai = new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "call-weather",
          name: "get_weather",
          args: { city: "杭州" },
        },
      ],
    });
    const tool = new ToolMessage({
      tool_call_id: "call-weather",
      content: '{"city":"杭州","simulated":true}',
    });

    observer.observe({ messages: [human, ai], todos: [], files: {} });
    observer.observe({
      messages: [human, ai, tool],
      todos: [{ content: "查询天气", status: "completed" }],
      files: {
        "/work/weather-report.md": { content: "# 杭州天气\n晴，28°C" },
      },
    });

    assert.equal(
      logs.filter((line) => line.startsWith("\n[Message")).length,
      3,
    );
    assert.ok(logs.some((line) => line.includes("get_weather")));
    assert.ok(logs.some((line) => line.includes("[completed] 查询天气")));
    assert.ok(logs.some((line) => line.includes("/work/weather-report.md")));
    assert.equal(
      readFileText(observer.snapshot().files, "/work/weather-report.md"),
      "# 杭州天气\n晴，28°C",
    );
  });
});
