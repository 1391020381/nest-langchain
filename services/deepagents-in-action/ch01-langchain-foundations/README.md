# 第一阶段：LangChain 四个基础概念

本章先不使用 `createAgent()` 或 `createDeepAgent()`，而是手写一次最小 Tool Calling 循环。目标不是重新实现生产框架，而是看清 DeepAgent 帮我们隐藏了什么。

## 1. 运行练习

本章沿用 `services/deepagents-in-action/.env` 中的模型配置。模型必须支持 Tool Calling。

在 `services/deepagents-in-action` 目录执行：

```powershell
bun run foundations "北京今天天气怎么样？"
bun test ch01-langchain-foundations
bun run typecheck
```

入口文件是 [`manual-agent-loop.ts`](./manual-agent-loop.ts)，确定性工具是 [`weather-tool.ts`](./weather-tool.ts)。脚本会打印每条 Message 的类型、产生者、内容、`tool_calls` 和 `tool_call_id`。

典型消息序列如下，模型的措辞可能不同，但角色顺序应当一致：

```text
SystemMessage   应用开发者写入规则
HumanMessage    用户提出天气问题
AIMessage       模型产生 get_weather tool_call
ToolMessage     应用执行工具并回填结果
AIMessage       模型根据工具结果生成最终回答
```

## 2. 四个基础概念怎样理解

### Message：一次执行的可检查记录

| Message | 谁产生 | 保存什么 | 为什么需要 |
| --- | --- | --- | --- |
| `SystemMessage` | 应用开发者 | 行为规则和边界 | 告诉模型应当怎样工作 |
| `HumanMessage` | 用户 | 当前输入 | 表达用户意图 |
| `AIMessage` | 模型 | 自然语言内容或 `tool_calls` | 表达模型下一步决定 |
| `ToolMessage` | 应用中的 Tool 执行器 | 工具执行结果和 `tool_call_id` | 把外部事实交还给模型 |

回答“这条 Message 是谁产生的”时，不要写“LangChain 产生”。LangChain 负责统一消息结构，真正的产生者分别是开发者、用户、模型或应用中的工具执行代码。

### Model：根据消息历史产生下一条 AIMessage

本章的关键调用是：

```ts
const aiMessage = await modelWithTools.invoke(messages);
```

- 输入：到当前为止的 `BaseMessage[]`。
- 输出：一条 `AIMessage`。
- 输出可能包含最终文字，也可能包含一个或多个 `tool_calls`。
- Model 不会直接执行本地 TypeScript 函数。

`bindTools(tools)` 的含义是把 Tool 的名称、描述和参数 Schema 提供给模型。它不是“调用工具”，也不是“启动 Agent”。

### Tool：应用提供给模型选择的确定性能力

一个 Tool 至少包含：

1. `name`：协议中的稳定标识；
2. `description`：告诉模型何时使用；
3. `schema`：约束模型应该生成的参数；
4. `func`：真正由应用执行的 TypeScript 函数。

模型只生成类似下面的调用意图：

```json
{
  "name": "get_weather",
  "args": { "city": "北京" },
  "id": "call-1"
}
```

应用根据 `name` 找到函数、校验 `args`、执行函数，然后创建具有同一个 `tool_call_id` 的 `ToolMessage`。这个 ID 将“模型提出的调用”和“应用返回的结果”关联起来。

### Agent loop：反复让模型决定下一步

本章手写循环的核心逻辑只有四步：

```text
1. 把完整 messages 交给模型
2. 将模型返回的 AIMessage 加入 messages
3. 如果存在 tool_calls，应用执行工具并加入 ToolMessage，然后回到第 1 步
4. 如果不存在 tool_calls，把 AIMessage 当作最终回答并停止
```

因此，“Agent 下一步由谁决定”需要分成两层回答：

- 模型决定是否请求某个 Tool，以及生成什么参数；
- 应用决定允许暴露哪些 Tool、是否执行、如何处理错误，以及何时强制停止。

## 3. 阶段问题应该怎样回答

### 问题一：每条 Message 是谁产生的？

推荐回答格式：

```text
第 0 条 SystemMessage 由应用开发者创建，用于设置天气助手规则。
第 1 条 HumanMessage 来自用户输入。
第 2 条 AIMessage 由模型返回；它没有最终答案，而是请求调用 get_weather。
第 3 条 ToolMessage 由应用执行 get_weather 后创建，并通过 tool_call_id 对应第 2 条调用。
第 4 条 AIMessage 由模型根据原问题和工具结果生成，是最终回答。
```

不要只列类型；必须说明产生者、数据内容和它对下一步的作用。

### 问题二：Tool 为什么被调用？

完整回答应包含三层原因：

1. 用户问题需要天气事实；模型自身不应编造该事实。
2. 应用通过 `bindTools()` 向模型提供了 `get_weather` 的名称、描述和 Schema。
3. 模型根据用户意图及 Tool 描述生成 `tool_call`；应用代码随后执行它。

“因为 Agent 自动调用了”不是合格答案，它没有区分模型决策和应用执行。

### 问题三：Model、Tool 各自接收和返回什么？

```text
Model：接收 Message[]，返回 AIMessage。
Tool：接收经过 Schema 校验的 args，返回字符串或可序列化结果。
应用：把 Tool 结果包装成 ToolMessage，再放回 Message[]。
```

回答时应尽量给出当前代码中的具体值，例如 `args = { city: "北京" }`，不要只背抽象定义。

### 问题四：循环为什么停止？

正常停止条件是最新 `AIMessage.tool_calls` 为空，说明模型当前给出的是自然语言结果而不是新的工具请求。

本章另外设置 `MAX_MODEL_TURNS = 5`，这是应用侧安全边界。即使模型持续调用工具，应用也不会无限循环。生产系统还需要超时、Token/费用预算、工具权限、重试和幂等性控制。

### 问题五：`bindTools()` 是否已经是 Agent？

不是。它只创建一个“知道有哪些工具”的模型 Runnable。工具查找、执行、`ToolMessage` 回填和循环停止仍然由本章代码完成。`createAgent()` 或 `createDeepAgent()` 才会把这些步骤组装成可复用的 Agent Harness。

## 4. 学习验收

先运行默认天气问题，再运行一个不需要工具的问题，例如：

```powershell
bun run foundations "请只回复：你好"
```

观察两次消息序列的区别，并完成下面的回答：

- [ ] 标出每条 Message 的产生者。
- [ ] 找到模型生成的 Tool 名称、参数和调用 ID。
- [ ] 找到具有相同 `tool_call_id` 的 ToolMessage。
- [ ] 说明第一次执行为什么需要 Tool，第二次为什么可以不调用。
- [ ] 说明模型决策和应用控制分别位于哪几行代码。
- [ ] 说明正常停止条件和安全停止条件的区别。

完成标准不是背下类名，而是能从终端输出还原这一条链路：

```text
用户意图
  → 模型生成工具调用意图
  → 应用校验并执行工具
  → 应用回填 ToolMessage
  → 模型生成最终回答
```

## 5. 与 DeepAgent 对照

完成本章后再运行：

```powershell
bun run hello
```

`ch02-quickstart/hello.ts` 使用 `createDeepAgent()` 完成相似任务。比较两份代码时重点寻找：

- 手写循环在哪里消失了？
- Message 是否仍然存在？
- 业务 Tool 是否仍然拥有名称、描述、Schema 和函数？
- DeepAgent 额外加入了哪些规划、文件系统和 Subagent 能力？

官方参考：

- [LangChain Messages](https://docs.langchain.com/oss/javascript/langchain/messages)
- [LangChain Tools](https://docs.langchain.com/oss/javascript/langchain/tools)
- [LangChain Agents](https://docs.langchain.com/oss/javascript/langchain/agents)
- [Deep Agents overview](https://docs.langchain.com/oss/javascript/deepagents/overview)

