import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import { setTimeout as sleep } from "node:timers/promises";

export async function slowResearch(state: typeof MessagesAnnotation.State, config: RunnableConfig) {
  const seconds = Number(process.env.ASYNC_DEMO_DELAY_SECONDS || 8);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 300) throw new Error("ASYNC_DEMO_DELAY_SECONDS 必须在 0–300 之间");
  // 使用可取消的异步等待；更新任务时 Agent Server 会 interrupt 旧 run。
  await sleep(seconds * 1000, undefined, { signal: config.signal });
  const requests = state.messages.filter((message) => message.getType() === "human").map((message) => String(message.content));
  const content = [
    `- 后台任务已完成，模拟耗时 ${seconds} 秒；此演示不执行真实搜索。`,
    `- 已收到的任务与追加约束：${requests.join("；")}`,
    "- 启动立即返回任务 ID，子任务后台执行；同一线程可查进度、追加指令和取消。",
  ].join("\n");
  return { messages: [{ role: "assistant" as const, content }] };
}

export const graph = new StateGraph(MessagesAnnotation)
  .addNode("slow_research", slowResearch)
  .addEdge(START, "slow_research")
  .addEdge("slow_research", END)
  .compile();
