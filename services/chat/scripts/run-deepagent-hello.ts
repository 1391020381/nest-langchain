/**
 * DeepAgent Hello World — 第十四章 14.4
 *
 * 概念：createDeepAgent 一行就装好 write_todos / 虚拟文件系统 / task。
 * 短任务通常只会调业务工具，todos 和 files 为空是正常的。
 *
 * 运行：cd services/chat && bun run scripts/run-deepagent-hello.ts
 */
import { createDeepAgent } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { join } from "path";
import { config } from "dotenv";

config({ path: join(import.meta.dir, "../.env") });

if (!process.env.OPENAI_API_KEY) {
  throw new Error("缺少 OPENAI_API_KEY。请先配置 services/chat/.env，或只跑 Layer 1：bun test test/chapter14-deepagent.spec.ts");
}

const getWeather = new DynamicStructuredTool({
  name: "get_weather",
  description: "获取指定城市的天气",
  schema: z.object({ city: z.string().describe("城市名") }),
  func: async ({ city }) => `${city}：晴，28°C，微风`,
});

const agent = createDeepAgent({
  model: new ChatOpenAI({
    model: process.env.DEEPAGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: process.env.OPENAI_BASE_URL
      ? { baseURL: process.env.OPENAI_BASE_URL }
      : undefined,
  }),
  tools: [getWeather],
  systemPrompt: "你是一个天气助手。用户问天气时，调用 get_weather 工具获取数据。",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "北京今天天气怎么样？" }],
});

const lastMsg = result.messages[result.messages.length - 1];
console.log("回复:", lastMsg.content);
console.log("todos:", JSON.stringify(result.todos ?? [], null, 2));
console.log("files:", Object.keys(result.files ?? {}));
