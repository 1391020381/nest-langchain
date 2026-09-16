import { test } from "node:test";
import assert from "node:assert/strict";
import { createProgressReporter, readReport } from "./progress";

test("完整报告从虚拟文件读取，缺失或空文件不算完成", () => {
  assert.equal(readReport({ "/research/report.md": { content: ["# 报告", "完整内容"] } }), "# 报告\n完整内容");
  assert.equal(readReport({}), undefined);
  assert.equal(readReport({ "/research/report.md": { content: [] } }), undefined);
});

test("当前 FileData v2 字符串报告可经过状态解析后读取", () => {
  const report = createProgressReporter(() => {});
  const state = report({
    todos: [{ content: "撰写报告", status: "completed" }],
    files: { "/research/report.md": {
      content: "# 完整报告\n\n正文与来源链接",
      mimeType: "text/markdown",
      created_at: "2026-09-15T00:00:00Z",
      modified_at: "2026-09-15T00:00:00Z",
    } },
  });
  assert.equal(readReport(state.files), "# 完整报告\n\n正文与来源链接");
  assert.ok(state.todos.every((todo) => todo.status === "completed"));
  assert.equal(readReport({ "/research/report.md": { content: "  \n" } }), undefined);
  assert.equal(readReport({ "/research/report.md": { content: new Uint8Array([1, 2]) } }), undefined);
});

test("展示任务状态变化，同一状态不重复输出", () => {
  const logs: string[] = [];
  const report = createProgressReporter((text) => logs.push(text));
  report({});
  for (const status of ["pending", "in_progress", "completed"]) {
    const state = { todos: [{ content: "搜索资料", status }] };
    report(state);
    report(state);
  }
  assert.equal(logs.length, 3);
  assert.match(logs[0], /pending/);
  assert.match(logs[1], /in_progress/);
  assert.match(logs[2], /completed/);
});

test("虚拟文件显示路径、不输出原文，不把工具请求当成执行结果", () => {
  const logs: string[] = [];
  const report = createProgressReporter((text) => logs.push(text));
  report({ messages: [{ tool_calls: [{ name: "write_todos", args: { todos: [] } }] }] });
  assert.equal(logs.length, 0);
  const state = { files: { "/research/report.md": { content: ["测试报告正文"] } } };
  assert.deepEqual(report(state).files, state.files);
  report(state);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /\/research\/report.md/);
  assert.doesNotMatch(logs[0], /测试报告正文/);
});
