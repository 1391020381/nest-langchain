import { createDeepAgent } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";

// 环境变量由 langgraph.json 加载。Agent Server 负责持久化，不传本地 checkpointer。
const siliconflowKey = process.env.SILICONFLOW_API_KEY?.trim();
const model = new ChatOpenAI({
  apiKey: siliconflowKey || process.env.OPENAI_API_KEY,
  model: siliconflowKey ? process.env.MODEL_NAME || "Qwen/Qwen2.5-7B-Instruct"
    : process.env.DEEPAGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4",
  configuration: { baseURL: siliconflowKey ? "https://api.siliconflow.cn/v1" : process.env.OPENAI_BASE_URL },
  temperature: 0, timeout: 60_000, maxRetries: 0,
});

export const graph = createDeepAgent({
  model,
  subagents: [{
    name: "researcher",
    graphId: "researcher",
    description: "用于后台异步验证任务，故意等待数秒后返回模拟结果，不进行真实搜索。",
    // JS SDK 使用 HTTP 访问同一个部署，不把它称为 Python ASGI。
    url: process.env.ASYNC_DEMO_URL || "http://127.0.0.1:2024",
  }],
  systemPrompt: `你是异步任务示例的 Supervisor，用中文回复。
用户要求后台研究时，立即调用 start_async_task，agentName 为 researcher。
启动后返回完整 taskId 并结束本轮，不要自动 check、不要等待任务完成。
用户明确询问进度时才调用 check_async_task 或 list_async_tasks，必须获取最新状态。
用户补充约束时必须调用 update_async_task，复用已有完整 taskId，不新建任务。
用户取消任务时调用 cancel_async_task。所有任务 ID 不得缩写或改写。`,
});
