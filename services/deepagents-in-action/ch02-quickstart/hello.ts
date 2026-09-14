/**
 * Datawhale 第 2 章 Hello World：最简单的 Deep Agent。
 *
 * 概念：createDeepAgent 一行就装好 write_todos / 虚拟文件系统 / task。
 * 短任务通常只会调业务工具，todos 和 files 为空是正常的。
 *
 * 运行：bun run demo:deepagent-hello
 * 天气是固定演示数据，不连接真实天气服务。
 */
import { createDeepAgent } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

// 配置硅基流动 Key 时使用课程配置，否则复用项目已有的兼容接口配置。
const siliconflowKey = process.env.SILICONFLOW_API_KEY?.trim();
const apiKey = siliconflowKey || process.env.OPENAI_API_KEY;
const modelName = siliconflowKey
  ? process.env.MODEL_NAME || "Qwen/Qwen2.5-7B-Instruct"
  : process.env.DEEPAGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4";
const baseURL = siliconflowKey
  ? "https://api.siliconflow.cn/v1"
  : process.env.OPENAI_BASE_URL;

if (!apiKey) {
  throw new Error("缺少模型密钥。请在 services/deepagents-in-action/.env 中配置 SILICONFLOW_API_KEY 或 OPENAI_API_KEY，详见 services/deepagents-in-action/README.md。");
}

const getWeather = new DynamicStructuredTool({
  name: "get_weather",
  description: "获取指定城市的模拟天气，仅用于教学演示，不代表实时天气",
  schema: z.object({ city: z.string().describe("城市名") }),
  func: async ({ city }) => {
    console.log(`[工具调用] get_weather(${JSON.stringify({ city })})`);
    return `${city}：晴，28°C，微风（模拟数据，非实时天气）`;
  },
});

const agent = createDeepAgent({
  model: new ChatOpenAI({
    model: modelName,
    temperature: 0,
    apiKey,
    configuration: baseURL ? { baseURL } : undefined,
    timeout: 30_000,
    maxRetries: 0,
  }),
  tools: [getWeather],
  systemPrompt: "你是一个友好的中文天气助手。用户问天气时，调用 get_weather 工具获取数据，并明确说明这是模拟天气，不是实时查询结果。",
});

const question = process.argv.slice(2).join(" ").trim() || "北京今天天气怎么样？";
console.log("问题:", question);
const result = await agent.invoke({
  messages: [{ role: "user", content: question }],
}, { recursionLimit: 10 });

const lastMsg = result.messages[result.messages.length - 1];
console.log("回复:", lastMsg.content);
