import { Client } from "@langchain/langgraph-sdk";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import assert from "node:assert/strict";
import { z } from "zod";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const client = new Client({ apiUrl: process.env.ASYNC_DEMO_URL || "http://127.0.0.1:2024", timeoutMs: 120_000 });
const tasksSchema = z.object({ asyncTasks: z.record(z.object({ taskId: z.string(), threadId: z.string(), runId: z.string() })) });

async function waitForResult(threadId: string, runId: string) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const run = await client.runs.get(threadId, runId);
    console.log("后台状态:", run.status);
    if (run.status === "success") return client.threads.getState(threadId);
    if (!["pending", "running"].includes(run.status)) throw new Error(`后台任务失败: ${run.status}`);
    await sleep(2000);
  }
  throw new Error("等待后台任务超时（120 秒）");
}

async function main() {
  const thread = await client.threads.create();
  console.log("thread_id =", thread.thread_id);
  if (process.argv.includes("--protocol")) {
    // 独立验证真实 Agent Server 的后台执行及 interrupt，不调用 LLM。
    const started = performance.now();
    const first = await client.runs.create(thread.thread_id, "researcher", { input: { messages: [{ role: "user", content: "验证后台任务" }] } });
    console.log(`启动 API 返回耗时: ${Math.round(performance.now() - started)}ms；run_id=${first.run_id}`);
    const status = await client.runs.get(thread.thread_id, first.run_id);
    assert.ok(["pending", "running"].includes(status.status), "首次检查任务应尚未完成，请使用默认 8 秒延迟");
    // 等原始输入进入 checkpoint 再中断，避免 pending run 尚未执行时丢掉原始输入。
    const checkpointDeadline = Date.now() + 10000;
    let savedInput = false;
    while (Date.now() < checkpointDeadline) {
      const state = await client.threads.getState(thread.thread_id);
      if (JSON.stringify(state.values).includes("验证后台任务")) { savedInput = true; break; }
      await sleep(100);
    }
    assert.ok(savedInput, "原始任务输入未写入 checkpoint");
    const updated = await client.runs.create(thread.thread_id, "researcher", {
      input: { messages: [{ role: "user", content: "补充约束：答案写成 3 条 bullet。" }] },
      multitaskStrategy: "interrupt",
    });
    assert.notEqual(updated.run_id, first.run_id);
    const final = await waitForResult(thread.thread_id, updated.run_id);
    assert.match(JSON.stringify(final.values), /补充约束/);
    assert.match(JSON.stringify(final.values), /验证后台任务/);
    console.log("协议验证通过：后台启动、同线程中断更新、结果回收。\n", JSON.stringify(final.values, null, 2));
    return;
  }
  async function ask(content: string) {
    const started = performance.now();
    const result = await client.runs.wait(thread.thread_id, "supervisor", { input: { messages: [{ role: "user", content }] } });
    if ("__error__" in result) throw new Error(JSON.stringify(result.__error__));
    console.log(`\nSupervisor 返回（${Math.round(performance.now() - started)}ms）`);
    const messages = z.object({ messages: z.array(z.object({ content: z.unknown() })) }).parse(result).messages;
    console.log(messages.at(-1)?.content);
    const state = tasksSchema.parse(result);
    console.log("任务状态:", JSON.stringify(state.asyncTasks, null, 2));
    return state;
  }
  const first = await ask("请把这个任务交给 researcher 异步处理：总结 async subagent 的关键行为。启动后立即返回完整任务 ID，不要查进度。");
  const tasks = Object.values(first.asyncTasks);
  assert.equal(tasks.length, 1, "Supervisor 应启动一个异步任务");
  const task = tasks[0];
  console.log("首次返回后的实际后台状态:", (await client.runs.get(task.threadId, task.runId)).status);
  await ask(`请查询任务 ${task.taskId} 的最新进度。`);
  const third = await ask(`给已有任务 ${task.taskId} 追加约束：完成时把答案写成 3 条 bullet。必须更新原任务，不新建任务。`);
  assert.equal(Object.keys(third.asyncTasks).length, 1);
  const updated = third.asyncTasks[task.taskId];
  assert.ok(updated, "追加指令必须保持 taskId 不变");
  assert.notEqual(updated.runId, task.runId, "追加指令应创建新的 run");
  await waitForResult(updated.threadId, updated.runId);
  await ask(`再次查询任务 ${task.taskId}，返回最终结果。`);
  console.log("异步 Supervisor 验证通过。");
}
main().catch((error: unknown) => {
  console.error("验证失败:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
