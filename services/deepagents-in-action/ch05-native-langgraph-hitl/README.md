# 第三阶段：用原生 LangGraph 实现人工介入

本练习不使用 `createDeepAgent()`，而是直接使用 `StateGraph`、`interrupt()`、`MemorySaver`、`thread_id` 和 `Command({ resume })` 实现最小审批流程：

```text
draft：生成模拟邮件操作建议
  → review：interrupt() 暂停
  → 人工 approve / edit / reject
  → 使用同一 thread_id 恢复
  → execute：仅在批准后执行模拟发送
```

本阶段刻意不调用模型。这样可以先把“谁保存状态、为什么暂停、怎样找到原执行、从哪里继续”完全归因于 LangGraph；理解后再回到 DeepAgent HITL Middleware。

## 浏览器运行

在仓库根目录运行：

```powershell
bun run demo:langgraph-hitl
```

打开 <http://127.0.0.1:2030>。页面可以创建请求、查看待审批邮件、批准原稿、修改后批准或拒绝，并展示最终 State、审计记录和模拟发件箱。服务只监听 `127.0.0.1`；可在 `.env` 中用 `NATIVE_HITL_PORT` 更换端口。

也可以进入 `services/deepagents-in-action` 运行：

```powershell
bun run hitl:native
```

前端通过以下接口与持有 LangGraph checkpoint 的后端交互：

| 方法与路径 | 用途 |
| --- | --- |
| `POST /api/sessions` | 创建流程并运行到 `interrupt()` |
| `GET /api/sessions/:id` | 读取 checkpoint、待审批内容和执行结果 |
| `POST /api/sessions/:id/resume` | 提交结构化决策并用同一 `thread_id` 恢复 |

命令行入口仍保留用于调试：

```powershell
bun run demo:langgraph-hitl:cli -- approve
bun run demo:langgraph-hitl:cli -- edit
bun run demo:langgraph-hitl:cli -- reject
```

浏览器和 CLI 支持的三个决策分别表示：

- `approve`：执行原始操作；
- `edit`：使用人工修改后的收件人、主题和正文执行；
- `reject`：结束流程，不产生发送副作用。

邮件只会写入进程内的模拟发件箱，不连接真实邮件服务。

## 核心机制

### State 与 Node

[`graph.ts`](./graph.ts) 中的 `ApprovalState` 保存请求、建议操作、人工决策、最终状态、结果和审计记录。图包含三个节点：

```text
START → draft → review → execute → END
                    └──────────────→ END（reject）
```

### interrupt 与 Checkpointer

`review` 节点调用：

```ts
const decision = interrupt(approvalRequest);
```

首次执行时，`interrupt()` 让图暂停。`MemorySaver` 保存 checkpoint，`getState()` 可以从 `tasks[].interrupts` 读取待审批数据。审批前模拟发件箱必须为空。

`MemorySaver` 只在当前进程内保存状态；进程重启后不能恢复。生产环境需要持久化 Checkpointer。

### thread_id 与恢复

首次运行与恢复必须使用同一个配置：

```ts
const config = {
  configurable: { thread_id: "稳定的业务线程 ID" },
};
```

恢复时不是重新提交原始请求，而是执行：

```ts
await graph.invoke(
  new Command({ resume: { type: "approve" } }),
  config,
);
```

Checkpointer 使用 `thread_id` 找到暂停的 checkpoint。`review` 节点恢复执行，`interrupt()` 返回 `resume` 中的值，然后条件边决定进入 `execute` 还是直接结束。

### 副作用边界

`interrupt()` 所在节点在恢复时会从节点开头重新执行，因此：

- `interrupt()` 之前只做可重复的校验和数据准备；
- 发送邮件、扣款、写外部数据库等副作用应放到批准后的独立节点；
- 生产系统的执行节点仍需使用幂等键防止重复副作用。

## LangSmith Trace 怎样阅读

本例沿用 `services/deepagents-in-action/.env` 中的 LangSmith 配置，Run Name 为 `stage3-native-langgraph-hitl`。点击开始后产生首次运行并在 `review` 暂停；从页面提交决策后，后端通过 `Command({ resume })` 产生恢复运行。

本阶段没有 Model Run 和 Tool Run，因此五个观察问题的答案是：

1. **模型收到哪些消息？** 没有调用模型；输入进入 `draft` State。
2. **暴露哪些工具？** 没有工具；`draft/review/execute` 是图节点。
3. **参数由谁生成？** 操作建议由 `draft` 节点生成，人工决策由调用方通过 `Command` 提交。
4. **执行返回什么？** `execute` 更新 `result/audit/status`，并写入模拟发件箱。
5. **为什么暂停或停止？** `interrupt()` 导致暂停；批准/修改路由到 `execute`；拒绝路由到 `END`。

## 验证

```powershell
bun test ch05-native-langgraph-hitl/graph.test.ts
bun test ch05-native-langgraph-hitl/sessions.test.ts
bun run typecheck
```

测试覆盖审批前无副作用、批准、修改、拒绝、不同 `thread_id` 的状态隔离、HTTP 页面/API 和重复审批保护。

