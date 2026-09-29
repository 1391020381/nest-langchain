import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";
import { Command } from "@langchain/langgraph";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  type ApprovalDecision,
  type ApprovalRequest,
  createNativeApprovalGraph,
  type SentEmail,
} from "./graph";

loadEnv({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

function decisionFromCli(mode: string): ApprovalDecision {
  if (mode === "approve") return { type: "approve" };
  if (mode === "reject") {
    return { type: "reject", reason: "演示拒绝：收件人范围需要重新确认。" };
  }
  if (mode === "edit") {
    return {
      type: "edit",
      action: {
        to: "reviewed-team@example.com",
        subject: "[已人工修改] 操作建议",
        body: "这是人工修改后的模拟邮件正文，仅用于 LangGraph HITL 教学。",
      },
    };
  }
  throw new Error("决策必须是 approve、edit 或 reject。");
}

async function main() {
  const mode = process.argv[2] || "approve";
  const request =
    process.argv.slice(3).join(" ").trim() ||
    "向团队发送一封本周发布计划通知";
  const decision = decisionFromCli(mode);
  const outbox: SentEmail[] = [];
  const graph = createNativeApprovalGraph(outbox);
  const threadId = randomUUID();
  const runConfig = {
    configurable: { thread_id: threadId },
    runName: "stage3-native-langgraph-hitl",
    tags: ["deepagents-in-action", "stage3", "native-langgraph-hitl"],
    metadata: { tutorial_stage: "native-langgraph-hitl", decision: mode },
  };

  console.log("thread_id:", threadId);
  console.log("用户请求:", request);
  console.log("\n[1] 首次 invoke：运行到 interrupt()");
  await graph.invoke({ request }, runConfig);

  const paused = await graph.getState(runConfig);
  const pending = paused.tasks.flatMap((task) => task.interrupts ?? []);
  if (pending.length !== 1) {
    throw new Error(`预期 1 个中断，实际得到 ${pending.length} 个。`);
  }
  console.log("状态:", paused.values.status);
  console.log("待审批内容:", pending[0].value as ApprovalRequest);
  console.log("发件箱数量:", outbox.length, "（审批前必须为 0）");

  console.log("\n[2] 使用相同 thread_id 和 Command({ resume }) 恢复");
  console.log("人工决策:", decision);
  const final = await graph.invoke(new Command({ resume: decision }), runConfig);

  console.log("\n[3] 最终状态");
  console.log("status:", final.status);
  console.log("result:", final.result);
  console.log("audit:", final.audit);
  console.log("outbox:", outbox);
}

main()
  .finally(() => awaitAllCallbacks())
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

