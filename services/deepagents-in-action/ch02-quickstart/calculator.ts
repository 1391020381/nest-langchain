/** 第 2 章“小试牛刀”：模型自行决定工具调用顺序。 */
import { createDeepAgent } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { calculateTool, convertCurrencyTool } from "./calculator-tools";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const siliconflowKey = process.env.SILICONFLOW_API_KEY?.trim();
const apiKey = siliconflowKey || process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("请在 services/deepagents-in-action/.env 配置 SILICONFLOW_API_KEY 或 OPENAI_API_KEY");
const model = new ChatOpenAI({
  apiKey,
  model: siliconflowKey
    ? process.env.MODEL_NAME || "Qwen/Qwen2.5-7B-Instruct"
    : process.env.DEEPAGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4",
  configuration: {
    baseURL: siliconflowKey ? "https://api.siliconflow.cn/v1" : process.env.OPENAI_BASE_URL,
  },
  temperature: 0,
  timeout: 30_000,
  maxRetries: 0,
});

const agent = createDeepAgent({
  model,
  tools: [calculateTool, convertCurrencyTool],
  systemPrompt: "你是中文计算助手，帮助用户做数学运算和货币换算。计算和换算必须使用对应工具，以工具返回值为依据。多步骤计算要使用前一步的实际结果。回答时简要展示步骤，并说明汇率为固定演示数据，非实时汇率。",
});

const question = process.argv.slice(2).join(" ").trim()
  || "帮我把 100 美元换算成人民币，再用它乘以 1.08 的通胀系数。";
console.log("问题:", question);
const result = await agent.invoke({
  messages: [{ role: "user", content: question }],
}, { recursionLimit: 15 });
console.log("回复:", result.messages[result.messages.length - 1].content);
