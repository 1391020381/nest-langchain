import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Command } from "@langchain/langgraph";

import {
  createNativeApprovalGraph,
  type SentEmail,
} from "./graph";

function config(threadId: string) {
  return { configurable: { thread_id: threadId } };
}

describe("原生 LangGraph HITL", () => {
  test("审批前暂停且没有副作用，批准后从同一线程恢复执行", async () => {
    const outbox: SentEmail[] = [];
    const graph = createNativeApprovalGraph(outbox);
    const runConfig = config("approve-thread");

    await graph.invoke({ request: "发送发布通知" }, runConfig);
    const paused = await graph.getState(runConfig);

    assert.equal(paused.values.status, "awaiting_review");
    assert.equal(outbox.length, 0);
    assert.equal(paused.tasks.length, 1);
    assert.equal(paused.tasks[0].interrupts.length, 1);
    assert.equal(paused.tasks[0].interrupts[0].value.kind, "email_approval");

    const final = await graph.invoke(
      new Command({ resume: { type: "approve" } }),
      runConfig,
    );

    assert.equal(final.status, "completed");
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, "team@example.com");
    assert.match(String(final.result), /模拟邮件已发送/);
  });

  test("人工修改后只执行修改后的操作", async () => {
    const outbox: SentEmail[] = [];
    const graph = createNativeApprovalGraph(outbox);
    const runConfig = config("edit-thread");
    await graph.invoke({ request: "发送通知" }, runConfig);

    const edited = {
      to: "owner@example.com",
      subject: "修改后的主题",
      body: "修改后的正文",
    };
    const final = await graph.invoke(
      new Command({ resume: { type: "edit", action: edited } }),
      runConfig,
    );

    assert.equal(final.status, "completed");
    assert.deepEqual(
      { to: outbox[0].to, subject: outbox[0].subject, body: outbox[0].body },
      edited,
    );
  });

  test("拒绝后结束流程且不执行操作", async () => {
    const outbox: SentEmail[] = [];
    const graph = createNativeApprovalGraph(outbox);
    const runConfig = config("reject-thread");
    await graph.invoke({ request: "发送通知" }, runConfig);

    const final = await graph.invoke(
      new Command({
        resume: { type: "reject", reason: "收件人尚未确认" },
      }),
      runConfig,
    );

    assert.equal(final.status, "rejected");
    assert.equal(outbox.length, 0);
    assert.match(String(final.result), /收件人尚未确认/);
  });

  test("thread_id 隔离不同审批流程", async () => {
    const outbox: SentEmail[] = [];
    const graph = createNativeApprovalGraph(outbox);
    const first = config("isolated-a");
    const second = config("isolated-b");

    await graph.invoke({ request: "通知 A" }, first);
    await graph.invoke({ request: "通知 B" }, second);
    await graph.invoke(
      new Command({ resume: { type: "approve" } }),
      first,
    );

    const firstState = await graph.getState(first);
    const secondState = await graph.getState(second);
    assert.equal(firstState.values.status, "completed");
    assert.equal(secondState.values.status, "awaiting_review");
    assert.equal(secondState.tasks[0].interrupts.length, 1);
    assert.equal(outbox.length, 1);
  });
});

