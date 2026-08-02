# 第三章 LangChain 编程 API 使用流程梳理

> 范围：LangChain 编程 API（不含 HTTP 路由清单）  
> 结构：分层目录（A）+ 对象生命周期（C）  
> 业务目标：需求文本 → `{ action, constraints, entities }`  
> 对应文档：`docs/AI Agents 开发实践/5-第三章：LangChain 起手——搭建第一条服务端能力链路.md`  
> 代码落点：`services/api/src/llm/*`

---

## 0. 业务目标

| 输入 | 输出 |
|------|------|
| 需求文本，例如「用户注册时必须绑定手机号，密码至少8位」 | `{ action: string; constraints: string[]; entities: string[] }` |

正式业务入口：`RequirementService.extract`（`POST /requirement/extract` 仅为落点，本文不展开 HTTP）。

---

## 1. 模型层（3.4）

### 对象卡

| 对象 | 如何创建 | 被谁消费 | 产出 |
|------|----------|----------|------|
| `ChatOpenAI` | `createChatModel()` → 内部 `new ChatOpenAI({ model, temperature, maxTokens, openAIApiKey, configuration.baseURL })` | `LlmService` / `RequirementService`；可被 `pipe`、`withStructuredOutput`、`bindTools` 包装 | `AIMessage`、流式 chunk，或包装后的 Runnable |

配置来自 YAML + 环境变量；业务代码不直接 `new ChatOpenAI`。

### API 表

| API | 关键参数 | 返回结果 | 作用 |
|-----|----------|----------|------|
| `createChatModel()` | 无（读配置） | `ChatOpenAI` | 统一模型入口 |
| `model.invoke(messages)` | `BaseMessage[]` | `AIMessage`（`.content` 自由文本） | 单次完整调用，默认主形态 |
| `model.stream(messages)` | 同上 | AsyncIterable chunk | 边生成边返回；难做结构化断言 |
| `model.batch(messageGroups)` | `BaseMessage[][]` | `AIMessage[]` | 同逻辑批量跑多条 |

### 业务位置

所有后续能力的底座。主业务最终仍是「带消息的模型调用」；`stream` / `batch` 多为演示分支。

---

## 2. 提示层（3.5）

### 对象卡

| 对象 | 如何创建 | 被谁消费 | 产出 |
|------|----------|----------|------|
| 提示常量 | `REQUIREMENT_SYSTEM_PROMPT` / `REQUIREMENT_USER_TEMPLATE`（含 `{input}`） | `ChatPromptTemplate.fromMessages` | 可维护的角色与用户模板 |
| `ChatPromptTemplate`（`requirementPrompt`） | `ChatPromptTemplate.fromMessages([["system", ...], ["human", ...]])` | 预览、拼消息、`pipe` 链、`RequirementService` | `PromptValue` 或 `BaseMessage[]` |

### API 表

| API | 关键参数 | 返回结果 | 作用 |
|-----|----------|----------|------|
| `ChatPromptTemplate.fromMessages(messages)` | 角色 + 模板字符串 | `ChatPromptTemplate` | 模板化、变量填充有据可查 |
| `requirementPrompt.invoke({ input })` | `{ input: string }` | `PromptValue`（可 `.toString()`） | 只渲染、不调模型，便于调试 |
| `requirementPrompt.formatMessages({ input })` | `{ input: string }` | `BaseMessage[]` | 转成模型可消费的消息 |

演示衔接：`formatMessages({ input }) → model.invoke(messages) → 自由文本`。

### 业务位置

解决提示内容不失控。主业务 `extract` 同样依赖模板化消息；`prompt.invoke` 预览是调试分支。

---

## 3. 链式层（3.6）

### 对象卡

| 对象 | 如何创建 | 被谁消费 | 产出 |
|------|----------|----------|------|
| `StringOutputParser` | `new StringOutputParser()` | `pipe` 末端 | `AIMessage` → `string` |
| `requirementChain` | `requirementPrompt.pipe(model).pipe(parser)` | `chainInvoke` / `chainStream` / `chainBatch` | 固定流程字符串结果 |

### API 表

| API | 关键参数 | 返回结果 | 作用 |
|-----|----------|----------|------|
| `runnable.pipe(next)` | 下一个 Runnable | 新 Runnable 链 | 模板→模型→解析收成流水线 |
| `chain.invoke({ input })` | `{ input: string }` | `string` | 固定流程一次性结果 |
| `chain.stream({ input })` | 同上 | 字符串 chunk 流 | 同流程、改展示方式 |
| `chain.batch([{ input }, ...])` | 输入对象数组 | `string[]` | 同题集批量 / 评测 |

数据流：`{ input } → ChatPromptTemplate → ChatOpenAI → StringOutputParser → string`。

### 业务位置

解决重复步骤统一管理。正式 `extract` 不用这条字符串链，而用结构化输出；本层是中间/演示形态。

---

## 4. 结构化输出层（3.7）— 业务主链核心

### 对象卡

| 对象 | 如何创建 | 被谁消费 | 产出 |
|------|----------|----------|------|
| `RequirementResultSchema` | Zod：`action` / `constraints` / `entities`（`@autix/contracts`） | `withStructuredOutput`、类型共享 | 可断言字段契约 |
| `structuredModel` | `model.withStructuredOutput(schema, { method: "functionCalling" })` | `RequirementService.extract` | `RequirementResult` 对象 |

本仓库选用 `functionCalling`，避免部分 OpenAI 兼容接口上 `jsonMode` 挂起。

### API 表

| API | 关键参数 | 返回结果 | 作用 |
|-----|----------|----------|------|
| `RequirementResultSchema` | 字段定义见 contracts | Zod schema / 类型 | 约定程序可消费形状 |
| `model.withStructuredOutput(schema, options)` | schema；可选 `method` | 可 `.invoke` 的包装模型 | 输出约束进 schema |
| `structuredModel.invoke(messages)` | `formatMessages` 的消息 | `{ action, constraints, entities }` | 本章业务终态调用 |

### 业务位置

相对字符串链，本层才让结果真正进入程序（API 返回、前端展示、测试断言）。

---

## 5. 工具层（3.8）

### 对象卡

| 对象 | 如何创建 | 被谁消费 | 产出 |
|------|----------|----------|------|
| Tool | `tool(asyncFn, { name, description, schema })` | `bindTools`、手动 `tool.invoke` | 确定性校验/查询结果 |
| `modelWithTools` | `model.bindTools([tools...])` | `toolBindDemo` / `toolLoopDemo` | 可能含 `tool_calls` 的 `AIMessage` |
| `ToolMessage` | `new ToolMessage({ tool_call_id, content })` | 回填 `messages` 后再 `invoke` | 工具结果进入下一轮推理 |

示例工具：

| name | 参数 | 返回 | 作用 |
|------|------|------|------|
| `check_constraint_validity` | `{ constraint }` | `{ constraint, passed, reason }` | 规则校验 |
| `lookup_entity_definition` | `{ entity }` | `{ entity, definition }` | 实体定义查询 |

### API 表

| API | 关键参数 | 返回结果 | 作用 |
|-----|----------|----------|------|
| `tool(fn, meta)` | fn + name/description/schema | `StructuredTool` | 本地函数声明为可调用能力 |
| `model.bindTools(tools)` | 工具数组 | 绑定后模型 | 允许模型发起 `tool_calls` |
| `response.tool_calls` | （读字段） | `{ name, args, id }[]` | 声明调用意图，尚未执行 |
| `targetTool.invoke(args)` | `toolCall.args` | 工具返回值 | 真正执行 |
| `new ToolMessage(...)` | `tool_call_id` + `content` | 消息 | 结果回填对话 |

闭环：`invoke` → 若有 `tool_calls` 则执行并 `ToolMessage` → 再 `invoke` → 最终答复。  
`toolBindDemo` 只观察 `tool_calls`，不执行工具。

### 业务位置

增强分支，非当前 `extract` 必经。分工：模型决策，工具给确定性结果。后续 RAG / MCP / Agent 扩展同一边界。

---

## 6. 业务串联：API 如何串成主链

### 主链（正式）

```text
createChatModel()
  → ChatPromptTemplate.formatMessages({ input })
  → model.withStructuredOutput(RequirementResultSchema)
  → structuredModel.invoke(messages)
  → RequirementResult
```

| 步骤 | API | 得到 | 解决 |
|------|-----|------|------|
| 1 | `createChatModel()` | 模型实例 | 统一接入 |
| 2 | `formatMessages({ input })` | 消息数组 | 提示可控 |
| 3 | `withStructuredOutput(schema)` | 结构化模型 | 输出可进程序 |
| 4 | `invoke(messages)` | 业务 JSON | 完成抽取 |

### 演示分支（学 API，非 extract 必经）

| 路径 | 串联 | 得到 |
|------|------|------|
| 裸模型 | messages → `invoke` / `stream` / `batch` | 自由文本 / 流 / 批量 |
| 提示预览 | `prompt.invoke` | 渲染串 |
| 固定链 | `prompt.pipe(model).pipe(StringOutputParser)` → `invoke\|stream\|batch` | `string` |
| 工具绑定 | `bindTools` → `invoke` | `tool_calls`（未执行） |
| 工具闭环 | 上一步 + `tool.invoke` + `ToolMessage` → 再 `invoke` | 最终答复 |

文档呈现原则：**主链加粗写清四步；演示分支保留完整「创建→调用→结果」表，标明非必经。**

---

## 7. 对象关系总览（C）

```text
                    createChatModel()
                           │
                      ChatOpenAI
              ┌────────────┼────────────────┐
              │            │                │
         .pipe(...)  withStructuredOutput  bindTools(tools)
              │            │                │
     requirementChain  structuredModel   modelWithTools
              │            │                │
        invoke/stream/   invoke →        invoke → tool_calls
        batch → string   RequirementResult   → tool.invoke
                                             → ToolMessage
                                             → invoke → 答复

ChatPromptTemplate ──formatMessages──► messages ──► 上述任一模型路径
                 └──pipe──► chain 首节点
```

中心对象是 `ChatOpenAI`；提示模板提供消息或作为链首；Tool / ToolMessage 仅出现在工具分支。

---

## 8. 范围与非目标

**在范围内**

- 第三章涉及的 LangChain 编程 API：创建对象、参数、返回值、业务串联
- 与仓库当前实现一致的说明（含 `functionCalling`）

**不在范围内**

- HTTP 路由 / Controller 契约清单
- 实现新功能或改业务代码
- RAG / MCP / Agent Runtime（仅点明与工具层边界的延续关系）

---

## 9. 落地产物

| 产物 | 路径 |
|------|------|
| 设计规格（本文） | `docs/superpowers/specs/2026-08-02-ch3-langchain-api-usage-flow-design.md` |
| 读者向速查（已归档） | `docs/5a-第三章附录：LangChain 编程 API 使用流程速查.md` |
| 实施计划 | `docs/superpowers/plans/2026-08-02-ch3-langchain-api-usage-flow.md` |

互链：课本第三章文首、`docs/learning-path.md` 第三章行。
