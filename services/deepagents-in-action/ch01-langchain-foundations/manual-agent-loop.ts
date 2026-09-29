/**
 * 第一阶段练习：不用 createAgent/createDeepAgent，手写最小 Tool Calling 循环。
 *
 * 运行：bun run foundations "北京今天天气怎么样？"
 */
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

import { printMessage } from "./message-inspector";
import { getWeatherTool } from "./weather-tool";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

const siliconflowKey = process.env.SILICONFLOW_API_KEY?.trim();
const apiKey = siliconflowKey || process.env.OPENAI_API_KEY;
const modelName = siliconflowKey
  ? process.env.MODEL_NAME || "Qwen/Qwen2.5-7B-Instruct"
  : process.env.OPENAI_MODEL || process.env.DEEPAGENT_MODEL || "gpt-5.4";
const baseURL = siliconflowKey
  ? "https://api.siliconflow.cn/v1"
  : process.env.OPENAI_BASE_URL;

if (!apiKey) {
  throw new Error(
    "缺少模型密钥。请先配置 services/deepagents-in-action/.env，详见本章 README。",
  );
}

const tools: StructuredToolInterface[] = [getWeatherTool];
const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
const model = new ChatOpenAI({
  model: modelName,
  temperature: 0,
  apiKey,
  configuration: baseURL ? { baseURL } : undefined,
  timeout: 30_000,
  maxRetries: 0,
});

// bindTools 只把名称、描述和参数 Schema 提供给模型，不会自动执行工具。
const modelWithTools = model.bindTools(tools);
const question =
  process.argv.slice(2).join(" ").trim() || "北京今天天气怎么样？";

const messages: BaseMessage[] = [
  new SystemMessage(
    "你是中文天气助手。天气问题必须调用 get_weather，并明确数据是模拟的。",
  ),
  new HumanMessage(question),
];

console.log("=== 初始消息 ===");
messages.forEach((message, index) => printMessage(index, message));

const MAX_MODEL_TURNS = 5;
for (let turn = 1; turn <= MAX_MODEL_TURNS; turn += 1) {
  // Model 的输入是到目前为止的完整消息历史，输出是一条 AIMessage。
  const aiMessage = await modelWithTools.invoke(messages);
  messages.push(aiMessage);
  printMessage(messages.length - 1, aiMessage);

  const toolCalls = aiMessage.tool_calls ?? [];
  if (toolCalls.length === 0) {
    console.log("\n=== 循环结束：最新 AIMessage 没有 tool_calls ===");
    break;
  }

  for (const toolCall of toolCalls) {
    const targetTool = toolsByName.get(toolCall.name);
    const content = targetTool
      ? await targetTool.invoke(toolCall.args)
      : `工具不存在：${toolCall.name}`;

    // ToolMessage 必须带回同一个 tool_call_id，模型才能匹配请求和结果。
    const toolMessage = new ToolMessage({
      tool_call_id: toolCall.id ?? `missing-id-${turn}`,
      content:
        typeof content === "string" ? content : JSON.stringify(content),
    });
    messages.push(toolMessage);
    printMessage(messages.length - 1, toolMessage);
  }

  if (turn === MAX_MODEL_TURNS) {
    throw new Error(`超过最大模型轮数 ${MAX_MODEL_TURNS}，Agent loop 未停止`);
  }
}

console.log("\n=== 最终消息序列 ===");
messages.forEach((message, index) => {
  console.log(`${index}. ${message.getType()}`);
});

