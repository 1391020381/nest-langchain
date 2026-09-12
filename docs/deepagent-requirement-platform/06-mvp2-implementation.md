# MVP-2：信息澄清与同线程恢复实施说明

## 1. 本阶段完成的业务闭环

MVP-2 解决“用户只说了一句话，但系统不能靠猜测直接生成报告”的问题。一次不完整需求会经历：

```text
提交不完整需求
  -> Root Agent 判断完整性
  -> 调用 request_requirement_clarification
  -> LangGraph interrupt() 保存中断点
  -> API 输出 clarification.required + run.paused(waiting)
  -> Web 渲染问题并收集答案
  -> 用户提交答案
  -> API 以相同 runId/threadId 恢复
  -> Command({ resume }) 回到原工具调用
  -> Root Agent 合并原始需求与答案
  -> 专家分析并写入 /work/final-report.md
  -> report.completed + run.done(completed)
```

如果用户不愿补充，可以“放弃本次运行”，等待态会收口为 `run.cancelled` 和 `run.done(cancelled)`。

## 2. 这是真中断，不是应用层模拟

澄清工具 `request_requirement_clarification` 内部直接调用 LangGraph 的 `interrupt()`。工具第一次执行时不会返回普通结果，而是让 DeepAgent 图停在当前节点，并通过 checkpointer 保存：

- 原始用户消息；
- Root Agent 已生成的工具调用；
- 当前工具节点及 interrupt payload；
- DeepAgent state 和消息历史。

恢复时没有重新提交原需求，也没有新建另一个 Agent。API 使用相同 `thread_id` 调用 `Command({ resume: ... })`，图从中断的工具节点恢复。工具收到答案后返回普通 ToolMessage，Root Agent 才继续规划和委派。

当前 checkpointer 是 `MemorySaver`，所以中断点可在同一个 API 进程中恢复，但 API 重启后会丢失。数据库 checkpointer、运行记录和产物跨重启恢复属于 MVP-4。

## 3. 完整性判断和问题由谁产生

Root Prompt 要求模型先判断需求是否包含足以影响设计和验收的关键信息。缺失时，模型生成结构化参数并调用澄清工具，而不是由 Web 根据字符串长度硬编码问题。

结构包括：

- `assessment.score`：0 到 1 的完整度；
- `assessment.missingFields`：缺失维度；
- `assessment.reason`：为什么不能安全继续；
- `questions`：1 到 6 个带稳定 id、字段类别、标题、问题、必填标记和提示语的问题。

Prompt 同时规定：澄清前不得建立 todos、委派专家、写文件或生成报告；恢复后不得重复询问同一个问题。

## 4. 运行状态和事件边界

初次流在等待用户时正常关闭 HTTP 响应，但业务运行没有结束：

```text
run.started
agent.progress(requirement-coordinator, started)
tool.progress(request_requirement_clarification, started)
clarification.required
run.paused(waiting)
```

这里故意没有 `run.done`，因为 `waiting` 不是终态。提交答案后创建新的 SSE HTTP 流，但仍属于同一个业务运行：

```text
run.resumed
...原 DeepAgent 继续执行...
report.completed
run.done(completed)
```

两个 HTTP 流里的 `runId`、`threadId` 保持一致，`sequence` 继续单调递增。Web 因此可以把暂停前后的事件展示成一条连续轨迹。

## 5. API

### 开始分析

`POST /api/agent/runs/stream`

```json
{
  "input": "增加一个批量导入成员的功能。",
  "threadId": "thread-demo"
}
```

响应是 SSE。完整需求最终以 `run.done` 结束；不完整需求以 `run.paused` 结束本段流。

### 提交澄清答案

`POST /api/agent/runs/{runId}/resume/stream`

```json
{
  "threadId": "thread-demo",
  "requestId": "本次提交的唯一 UUID",
  "answers": [
    {
      "questionId": "max_rows",
      "value": "单次最多 10,000 行"
    }
  ]
}
```

服务端会校验 run、thread、等待状态、问题 id、重复回答和必填答案。`requestId` 已处理过时返回冲突，不会再次恢复图或重复业务动作。

### 放弃等待中的运行

`POST /api/agent/runs/{runId}/cancel`

```json
{
  "threadId": "thread-demo"
}
```

只有 `waiting` 状态允许通过此接口放弃。重复放弃返回第一次生成的相同终态事件，不重复改变状态。

## 6. 关键代码位置

| 模块 | 位置 | 作用 |
| --- | --- | --- |
| 公共协议 | `packages/requirement-deepagent-contracts/src/index.ts` | 完整性、问题、答案、暂停和恢复事件 |
| 澄清工具 | `services/requirement-deepagent-api/src/agent/clarification.tool.ts` | 校验结构化参数并调用 `interrupt()` |
| Root Prompt | `services/requirement-deepagent-api/src/agent/root/coordinator.prompt.ts` | 先澄清、后分析的决策和禁止事项 |
| Agent 工厂 | `services/requirement-deepagent-api/src/agent/agent.factory.ts` | 注册澄清工具和 `MemorySaver` |
| DeepAgent 适配 | `services/requirement-deepagent-api/src/agent/runtime/deepagent.runtime.ts` | 读取 interrupt state，以 `Command` 恢复原图 |
| 运行生命周期 | `services/requirement-deepagent-api/src/agent/agent.service.ts` | 等待态、恢复校验、幂等、序号和取消收口 |
| HTTP/SSE | `services/requirement-deepagent-api/src/agent/agent.controller.ts` | 开始、恢复和放弃三个接口 |
| Web 客户端 | `clients/requirement-deepagent-web/lib/api.ts` | 识别 `run.paused` 流边界并调用恢复接口 |
| 澄清界面 | `clients/requirement-deepagent-web/app/requirement-workbench.tsx` | 展示问题、校验必填、继续或放弃 |

## 7. 为什么同时保留 runId 和 threadId

`threadId` 是 DeepAgent/checkpointer 找到上下文的键；`runId` 是产品层的一次分析运行。MVP-2 中两者都要匹配，避免用户把 A 运行的答案错误提交到 B 线程。

当前一个运行只属于一个线程。未来同一会话可以有多次运行，运行记录持久化后，`runId` 还会用于审计、幂等和查看历史。

## 8. Web 体验步骤

在项目根目录启动：

```powershell
bun run dev:requirement-deepagent
```

打开 `http://localhost:3200`：

1. 点击“使用待澄清示例”。
2. 点击“开始 DeepAgent 分析”。
3. 等待页面显示完整度、澄清原因和问题表单。
4. 填写所有必填项，点击“提交并继续分析”。
5. 确认轨迹中先出现 `run.paused`，随后出现 `run.resumed`，运行 id 和会话 id 没有变化。
6. 查看最终报告，确认包含原需求和补充条件。

模型请求会把需求和澄清答案发送到 `OPENAI_BASE_URL` 指向的服务，不要输入未经授权的敏感数据。

## 9. 自动验收

默认测试使用脚本模型，不访问网络，覆盖：

- DeepAgent 真正执行澄清工具并产生 interrupt；
- 同一 thread checkpoint 使用 `Command` 恢复；
- 澄清前没有报告，恢复后报告包含原需求与答案；
- 初次流和恢复流的 run/thread 一致、sequence 连续；
- 未答必填问题时拒绝恢复；
- 相同 `requestId` 不重复处理；
- 等待态放弃及重复放弃幂等；
- SSE 客户端将 `run.paused` 识别为正常流边界。

执行：

```powershell
bun run test:requirement-deepagent
bun run typecheck:requirement-deepagent
bun run build:requirement-deepagent
```

真实模型测试仍通过 `RUN_LIVE_REQUIREMENT_AGENT_TESTS=1` 显式开启；默认验收不会把示例需求发往外部服务。

## 10. MVP-2 明确不做

- API 重启后的 checkpoint、运行和产物恢复（MVP-4）。
- 页面刷新后重新拉取等待问题（MVP-4）。
- 功能、性能、安全和合规多专家并行（MVP-3）。
- RAG、MCP、外部写操作和人工审批（MVP-5/6）。

