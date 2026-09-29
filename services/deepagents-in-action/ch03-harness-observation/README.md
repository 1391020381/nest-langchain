# 第二阶段：回到 DeepAgent，观察 Harness 自动组装了什么

第一阶段手写了 Model → Tool → Model 循环。本章使用 `createDeepAgent()` 完成相近任务，并通过 State 流观察 Message、Tool Call、Todo 和虚拟文件的变化。

目标不是再次学习天气示例，而是回答：**第一阶段手写的哪些代码消失了，它们现在由谁负责？**

## 1. 运行

在仓库根目录运行：

```powershell
bun run demo:deepagent-harness
```

或在 `services/deepagents-in-action` 中运行：

```powershell
bun run harness:observe
bun test ch03-harness-observation
bunx tsc --noEmit -p tsconfig.json
```

真实运行沿用 `services/deepagents-in-action/.env`，模型必须支持 Tool Calling。默认任务要求 Agent：

1. 使用 `write_todos` 建立计划；
2. 使用业务工具 `get_weather`；
3. 使用 `write_file` 创建 `/work/weather-report.md`；
4. 完成 Todo；
5. 返回最终回答。

入口是 [`run.ts`](./run.ts)，Agent 组装位于 [`agent.ts`](./agent.ts)，State 观察器位于 [`observer.ts`](./observer.ts)。

## 2. 与第一阶段逐项对照

第一阶段手写代码：

```text
bindTools
→ 调用 Model
→ 读取 AIMessage.tool_calls
→ 按名称查找 Tool
→ 执行 Tool
→ 创建 ToolMessage
→ 回填 messages
→ 再次调用 Model
→ 判断是否停止
```

第二阶段业务代码只需要：

```ts
const agent = createDeepAgent({
  model,
  tools: [getWeatherTool],
  systemPrompt,
});

await agent.invoke({ messages: [...] });
```

这里不是取消了循环，而是把循环交给 Harness：

| 第一阶段责任 | 第二阶段由谁处理 |
| --- | --- |
| `model.bindTools()` | DeepAgent/LangChain Agent Harness |
| 读取 `AIMessage.tool_calls` | Agent loop |
| 查找并执行 Tool | Tool 执行节点 |
| 创建 `ToolMessage` | Tool 执行节点 |
| 把结果放回 `messages` | LangGraph State 更新 |
| 再次调用 Model | Agent loop 路由 |
| 无 Tool Call 时结束 | Agent loop 结束条件 |
| 最大循环保护 | `recursionLimit` 等运行配置 |

所以外部只调用一次 `agent.invoke()`，内部仍可能多次调用 Model。

## 3. `createDeepAgent()` 默认带来了什么

当前锁定的 `deepagents 1.10.2` 会组装一套带有默认中间件的 Agent Harness。要区分“默认存在”和“需要配置后才启用”：

| 能力 | 本章状态 | 怎样观察 |
| --- | --- | --- |
| Agent loop | 默认存在 | 多条 `AIMessage` 和 `ToolMessage` 连续出现 |
| Todo | 默认存在 | 模型可调用 `write_todos`，State 出现 `todos` |
| 虚拟文件系统 | 默认存在 | 模型可调用 `write_file`，State 出现 `files` |
| Context summarization | 默认中间件能力 | 短任务通常不会触发；长上下文达到阈值后才工作 |
| General-purpose Subagent | 默认 Profile 可能提供 | 通过 `task` 调用；本章刻意不委派 |
| 自定义 Subagent | 需要配置 `subagents` | 后续异步 Subagent 章节演示 |
| Backend | 默认使用临时 StateBackend | 文件只存在于当前运行 State，不是宿主机文件 |
| 长期 Memory | 需要 Store/Backend 等持久化配置 | 本章没有实现，不能把临时文件称为长期记忆 |
| Human-in-the-loop | 需要 `interruptOn`、`interrupt()`、Checkpointer | 第九章单独演示 |

“DeepAgent 有某项能力”不等于“当前程序已经正确启用了该能力”。学习时必须指出配置、触发条件、状态保存位置和验收证据。

## 4. 终端输出怎样阅读

观察器消费 `streamMode: "values"`。每当 LangGraph State 更新时，它只打印新增或变化的部分。

典型过程如下：

```text
HumanMessage
AIMessage(tool_call: write_todos)
ToolMessage(write_todos result)
[Todos] 状态变化

AIMessage(tool_call: get_weather)
ToolMessage(weather result)

AIMessage(tool_call: write_file)
ToolMessage(write_file result)
[Files] /work/weather-report.md

AIMessage(tool_call: write_todos)
ToolMessage(write_todos result)
[Todos] 全部 completed

AIMessage(final answer)
```

不同模型可能合并或调整调用顺序。验收重点不是逐字一致，而是业务 Tool、Todo、文件和最终回答都有真实证据。

## 5. 五个观察问题怎样回答

### 问题一：模型收到了哪些消息？

从本地 State 输出可以确认业务消息序列：用户消息、模型 Tool Call、ToolMessage 和最终 AIMessage。完整的最终模型输入还包含 Harness 组装的系统提示和工具描述；开启 LangSmith Trace 后，在对应 Model Run 的 Inputs 中查看。

合格回答示例：

```text
第一次模型调用至少收到 Harness/业务系统指令和 HumanMessage。
调用 get_weather 后，下一次模型调用还会收到请求该工具的 AIMessage，
以及应用执行后生成、具有相同 tool_call_id 的 ToolMessage。
因此每轮 Model 输入都比上一轮包含更多执行证据。
```

不要声称终端里的 State 已经展示了完整默认 System Prompt；精确模型输入应以 Trace 为准。

### 问题二：当前暴露了哪些工具？

回答时分三类：

```text
业务工具：get_weather，由当前应用显式传入。
Harness 工具：write_todos、ls、read_file、write_file、edit_file、glob、grep 等，
由 DeepAgent 中间件加入；具体集合受版本、Backend 和 Profile 影响。
Subagent 工具：task，只有存在可用 Subagent 配置/Profile 时才有意义。
```

实际运行调用了哪些工具，应从 `AIMessage.tool_calls` 或 LangSmith Trace 判断，不要把“已暴露”和“已调用”混为一谈。

### 问题三：工具参数由谁生成？

模型根据用户任务、System Prompt、Tool description 和 Tool Schema 生成参数。例如：

```json
{
  "name": "get_weather",
  "args": { "city": "杭州" }
}
```

DeepAgent 不替模型决定 `city` 的值；Harness 负责把 Tool 暴露给模型、校验调用并调度执行。

### 问题四：Tool 执行后返回了什么？

查找紧跟 Tool Call 的 `ToolMessage`：

- `tool_call_id` 应与 `AIMessage.tool_calls[].id` 一致；
- `content` 是工具函数的真实返回结果；
- 后续模型调用通过消息历史看到这个结果。

`get_weather` 返回 JSON 字符串；`write_todos` 和 `write_file` 还会更新 State 中的 `todos` 或 `files`。

### 问题五：Agent 为什么继续、暂停或停止？

```text
继续：最新 AIMessage 含有 tool_calls，Harness 路由到工具节点，执行后再回到模型。
停止：最新 AIMessage 没有 tool_calls，Harness 把它作为最终输出。
失败停止：超过 recursionLimit、模型/工具抛错或最终业务校验失败。
暂停：需要配置 HITL；遇到 interrupt 后保存状态并等待 resume。本章不会暂停。
```

回答这个问题时必须同时说明“模型意图”和“应用控制”：模型提出下一步，Harness 和运行配置决定是否允许执行及怎样路由。

## 6. 怎样查看 LangSmith Trace

在 `.env` 中配置：

```dotenv
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=你的密钥
LANGSMITH_PROJECT=deepagents-in-action-stage2
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
```

运行 `bun run harness:observe` 后，在 LangSmith 中打开 `ch03-harness-observation`：

1. 展开 Model Run，检查实际输入消息和可用 Tool Schema；
2. 展开 Tool Run，检查参数、返回值、耗时和错误；
3. 按时间顺序解释 Model → Tool → Model；
4. 对照终端的 Todo/File State 更新。

Trace 展示调用输入输出，不代表模型未公开的内部思考过程。

## 7. 本阶段的后续练习入口

本章先建立 Harness 心智模型，其他能力沿用当前工程已有练习：

1. Todo、虚拟文件与长任务：[第 4 章任务规划](../ch04-task-planning/README.md)
2. Subagent 与异步执行：[第 6 章异步 Subagent](../ch06-async-subagents/README.md)
3. 人工介入与恢复：[第 9 章 Human-in-the-loop](../ch09-human-in-the-loop/README.md)

完成标准：能够用一次实际运行的 Message、Todo、File 和 Trace 证据，解释 DeepAgent 替第一阶段手写循环接管了哪些责任；同时能明确指出长期记忆、持久化和 HITL 并不是本章自动获得的能力。

