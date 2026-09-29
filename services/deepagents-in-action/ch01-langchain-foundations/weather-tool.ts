import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * 固定教学数据：练习重点是 Tool Calling，不是天气接口。
 * Tool 的返回值必须能作为 ToolMessage 内容再次交给模型。
 */
export const getWeatherTool = new DynamicStructuredTool({
  name: "get_weather",
  description:
    "查询指定城市的模拟天气。用户询问天气、温度或出行建议时使用。返回教学数据，不是实时天气。",
  schema: z.object({
    city: z.string().min(1).describe("需要查询天气的城市名"),
  }),
  func: async ({ city }) =>
    JSON.stringify({
      city,
      condition: "晴",
      temperatureCelsius: 28,
      wind: "微风",
      simulated: true,
    }),
});

