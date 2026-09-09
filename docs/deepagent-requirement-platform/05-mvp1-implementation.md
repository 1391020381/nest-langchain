# MVP-1：单需求 DeepAgent 分析实施说明

## 1. 本阶段完成的业务闭环

输入是一条信息较完整的软件需求，输出是一份可以直接查看的 Markdown 分析报告：

```text
浏览器提交需求
  -> API 建立 SSE 运行
  -> requirement-coordinator 调用 write_todos
  -> task 唯一一次委派 requirement-analyst
  -> 专家返回需求分析
  -> Root Agent 写入 /work/final-report.md
  -> 适配层导出 StateBackend 中的虚拟产物
  -> Web 展示轨迹、todos、报告和产物
  -> run.done(completed | failed | cancelled)
```

MVP-1 没有手写 `StateGraph`，业务入口从第一天起就是 `createDeepAgent()`。LangGraph 只作为 DeepAgent 的底层运行依赖存在。

## 2. 角色与职责

### requirement-coordinator

Root Agent 只做四件事：

1. 调用 `write_todos` 建立三项计划。
2. 调用 `task`，且只委派一次 `requirement-analyst`。
3. 根据专家结果整理报告。
4. 调用 `write_file` 把唯一最终产物写入 `/work/final-report.md`，完成 todos 后立即结束。

Prompt 同时规定了停止条件，避免重复委派、重复写文件或反复读取。

### requirement-analyst

子 Agent 只返回分析内容，不再委派、不维护 Root todos、不写文件。输出必须覆盖：

- 需求摘要；
- 完整性分析；
- 复杂度评估；
- 风险及缓解建议；
- 用户故事；
- 可测试验收标准。

这种边界保证最终报告只有一个写入者。MVP-3 引入并行专家时，各专家才会拥有独立产物路径。

## 3. 关键代码位置

| 模块 | 位置 | 作用 |
| --- | --- | --- |
| 公共协议 | `packages/requirement-deepagent-contracts/src/index.ts` | 请求、SSE 业务事件、todo 和虚拟产物结构 |
| Root Prompt | `services/requirement-deepagent-api/src/agent/root/coordinator.prompt.ts` | 工作顺序、唯一产物地址和终止条件 |
| 子 Agent | `services/requirement-deepagent-api/src/agent/subagents/requirement-analyst.ts` | 单需求分析职责与工具限制 |
| Agent 工厂 | `services/requirement-deepagent-api/src/agent/agent.factory.ts` | 创建 DeepAgent、注册 subagent、限制 `/work` 权限 |
| 底层事件适配 | `services/requirement-deepagent-api/src/agent/runtime/deepagent.runtime.ts` | 监听 DeepAgent 事件并转换为业务进度 |
| VFS 导出 | `services/requirement-deepagent-api/src/agent/runtime/state-exporter.ts` | 从最终 Root state 读取 todos 和 `/work` 文件 |
| 生命周期 | `services/requirement-deepagent-api/src/agent/agent.service.ts` | runId、sequence、取消、超时、公开错误、唯一终态 |
| SSE 控制器 | `services/requirement-deepagent-api/src/agent/agent.controller.ts` | POST 流、心跳、断线转 AbortSignal |
| Web 流客户端 | `clients/requirement-deepagent-web/lib/api.ts` | 读取 fetch response stream 并解析 SSE 分片 |
| 工作台 | `clients/requirement-deepagent-web/app/requirement-workbench.tsx` | 输入、取消、轨迹、计划、报告和产物展示 |

## 4. 为什么仍需要运行时适配层

DeepAgent/LangChain 的 `on_chain_start`、`on_tool_start` 等事件属于底层实现协议，页面不应该直接理解这些名字。`deepagent.runtime.ts` 只承担两类边界工作：

- 识别 Root Agent、task、write_todos 和文件工具，转换成稳定的业务事件；
- 在 Root 运行结束后读取最终 state，导出 todos 和 `/work` 产物。

运行成功与否最终仍以 Root state 和 `/work/final-report.md` 为准，中间事件只用于用户可见进度。LangSmith 负责开发观测和追踪，不负责浏览器产品交互、SSE 生命周期或公开错误协议，所以不能替代这层适配。

## 5. 业务事件协议

一次成功运行的最小顺序是：

```text
run.started
agent.progress(requirement-coordinator, started)
tool.progress(write_todos, started/completed)
plan.updated
tool.progress(task, started)
agent.progress(requirement-analyst, started/completed)
tool.progress(task, completed)
tool.progress(write_file, started/completed)
artifact.available
report.completed
run.done(completed)
```

只有 `run.done` 是终态事件，每次运行恰好一个。`run.error` 和 `run.cancelled` 提供原因，随后分别以 `run.done(failed)` 或 `run.done(cancelled)` 收口。

每个事件包含相同的 `runId`、`threadId`，以及从 1 单调递增的 `sequence`。前端因此不需要解析日志，也不依赖底层 run id。

## 6. 取消、超时与错误

- Web 点击取消会中止 fetch。
- HTTP 连接关闭触发服务端 `AbortController`。
- 同一个 signal 继续传给 DeepAgent，停止模型和工具链。
- 服务层在取消后不再推送报告，只生成 cancelled 终态（连接仍可写时）。
- `REQUIREMENT_AGENT_RUN_TIMEOUT_MS` 限制整次运行；`REQUIREMENT_AGENT_MODEL_TIMEOUT_MS` 限制单次模型请求；`REQUIREMENT_AGENT_RECURSION_LIMIT` 限制图步数。
- 内部异常只写服务端带 runId 的日志；前端得到固定错误码和安全文案。

## 7. `/work` 为什么在电脑目录中找不到

本阶段使用 DeepAgent 默认 `StateBackend`。`/work/final-report.md` 是 Agent state 中的虚拟文件，不是 `D:\work`，也不是仓库下的 `work` 文件夹。

运行结束时 `state-exporter.ts` 将其转换成：

```ts
{
  path: "/work/final-report.md",
  content: "...",
  mediaType: "text/markdown",
  sizeChars: 1234,
  virtual: true
}
```

MVP-1 只在本次响应中展示它，刷新后不会保留。MVP-4 会把虚拟文件显式导出到受控 artifact store，并保存归属、元数据和下载地址。

## 8. 启动与体验

在项目根目录执行：

```powershell
bun run dev:requirement-deepagent
```

打开 `http://localhost:3200`：

1. 确认 API 和配置状态正常，可先点击“检查模型”。
2. 使用页面内置的批量导入示例，或输入自己的完整需求。
3. 点击“开始 DeepAgent 分析”。
4. 观察 `write_todos`、`task`、`requirement-analyst` 和 `write_file` 事件。
5. 查看最终 Markdown 和 `/work/final-report.md` 虚拟产物。

模型请求会把输入正文发送到 `OPENAI_BASE_URL` 对应的服务。不要提交未经授权的敏感业务数据。

## 9. 验证命令

默认验证不调用外部模型：

```powershell
bun run typecheck:requirement-deepagent
bun run test:requirement-deepagent
bun run build:requirement-deepagent
```

只有明确允许向当前模型服务发送示例需求时，才在 API workspace 显式运行：

```powershell
$env:RUN_LIVE_REQUIREMENT_AGENT_TESTS = "1"
bun test test/live-requirement-agent.test.ts
Remove-Item Env:RUN_LIVE_REQUIREMENT_AGENT_TESTS
```

确定性测试覆盖事件顺序、唯一终态、取消、公开错误、SSE 分片解析以及 StateBackend 文件导出。真实模型测试验证实际委派、报告标题和最终产物。

## 10. MVP-1 明确不做

- 不完整需求的澄清和恢复（MVP-2）。
- 多专家并行和失败隔离（MVP-3）。
- 会话、运行和产物的持久化（MVP-4）。
- RAG、MCP、业务写工具和人工审批（MVP-5/6）。
