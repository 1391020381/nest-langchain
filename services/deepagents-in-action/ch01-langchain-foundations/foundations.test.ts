import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AIMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";

import { inspectMessage } from "./message-inspector";
import { getWeatherTool } from "./weather-tool";

describe("LangChain 基础练习", () => {
  test("工具 Schema 接收城市并返回可交给模型的字符串", async () => {
    const result = await getWeatherTool.invoke({ city: "杭州" });
    assert.equal(typeof result, "string");
    assert.deepEqual(JSON.parse(String(result)), {
      city: "杭州",
      condition: "晴",
      temperatureCelsius: 28,
      wind: "微风",
      simulated: true,
    });
  });

  test("能够识别 Message 的产生者和工具调用关联", () => {
    const human = inspectMessage(new HumanMessage("北京天气？"));
    const ai = inspectMessage(
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call-1",
            name: "get_weather",
            args: { city: "北京" },
          },
        ],
      }),
    );
    const tool = inspectMessage(
      new ToolMessage({
        tool_call_id: "call-1",
        content: '{"city":"北京"}',
      }),
    );

    assert.equal(human.producer, "用户");
    assert.equal(ai.producer, "模型");
    assert.deepEqual(ai.toolCalls[0], {
      id: "call-1",
      name: "get_weather",
      args: { city: "北京" },
    });
    assert.equal(tool.producer, "应用中的 Tool 执行器");
    assert.equal(tool.toolCallId, "call-1");
  });
});
