import { test } from "node:test";
import assert from "node:assert/strict";
import { HumanMessage } from "@langchain/core/messages";
import { slowResearch } from "./researcher";

test("慢任务保留原任务及追加约束，并输出三条 bullet", { timeout: 15000 }, async () => {
  const result = await slowResearch({ messages: [new HumanMessage("原始任务"), new HumanMessage("补充约束")] }, {});
  assert.match(result.messages[0].content, /原始任务；补充约束/);
  assert.equal(result.messages[0].content.split("\n").length, 3);
});

test("慢任务响应取消，不继续生成结果", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(slowResearch({ messages: [] }, { signal: controller.signal }), { name: "AbortError" });
});
