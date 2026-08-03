# 第三、四章：LangChain 主要 API 与应用流程

来源：

- [`AI Agents 开发实践/5-第三章：LangChain 起手——搭建第一条服务端能力链路.md`](../AI%20Agents%20开发实践/5-第三章：LangChain%20起手——搭建第一条服务端能力链路.md)
- [`AI Agents 开发实践/6-第四章：LangChain 进阶——记忆、工具与多 Agent.md`](../AI%20Agents%20开发实践/6-第四章：LangChain%20进阶——记忆、工具与多%20Agent.md)

本文按「对象 → 入参 → 返回 → 用途」梳理两章主链路中的核心 API，并串起大致应用流程。

---

## 1. 整体应用流程

```text
输入文本
  → ChatPromptTemplate（提示模板化）
  → ChatOpenAI（模型调用）
  → 输出形态分支：
      · 自由文本 → StringOutputParser
      · 结构化   → withStructuredOutput(Zod)
      · 需外部事实 → bindTools + tool loop
  → 业务接口收束
  → 进阶能力：Memory / Embeddings / Multi-Agent
```

递进关系：

1. **模型层**：`ChatOpenAI` + `invoke` / `stream` / `batch`
2. **提示层**：`ChatPromptTemplate` 变量填充
3. **链式层**：`pipe()` 固定「模板 → 模型 → 解析」
4. **解析层**：`withStructuredOutput` 产出可断言 JSON
5. **工具层**：`tool()` + `bindTools` + `ToolMessage` 闭环
6. **进阶层**：Memory / Embeddings / Multi-Agent → 统一业务入口

---

## 2. 主要 API 速查

### 2.1 模型：`ChatOpenAI`

| 项 | 内容 |
| --- | --- |
| **构造入参** | `model`, `temperature`, `maxTokens`, `openAIApiKey`, `configuration.baseURL` |
| **返回** | 可调用的聊天模型实例 |

| 方法 | 入参 | 返回 | 场景 |
| --- | --- | --- | --- |
| `invoke(messages)` | `BaseMessage[]`（如 `SystemMessage` + `HumanMessage`） | `AIMessage`（`.content` 为文本） | 单次拿完整结果 |
| `stream(messages)` | 同上 | `AsyncIterable<AIMessageChunk>` | 边生成边推 SSE |
| `batch(messageGroups)` | `BaseMessage[][]` | `AIMessage[]` | 批量 / 离线 / 评测 |

消息类：

- `SystemMessage(content)` / `HumanMessage(content)` / `AIMessage` / `ToolMessage({ tool_call_id, content })`
- 共同基类：`BaseMessage`

### 2.2 提示模板：`ChatPromptTemplate`

| API | 入参 | 返回 | 说明 |
| --- | --- | --- | --- |
| `fromMessages([[role, tpl], ...])` | 如 `['system', '...']`, `['human', '{input}']`，也可 `MessagesPlaceholder('history')` | `ChatPromptTemplate` | 组装可复用提示 |
| `invoke({ input, ... })` | 变量对象 | `PromptValue`（`.toString()` 可看渲染结果） | 预览，不调模型 |
| `formatMessages({ input })` | 变量对象 | `BaseMessage[]` | 填变量 → 消息数组，再交给模型 |

### 2.3 链式编排：`pipe()` + Runnable

| API | 入参 | 返回 | 说明 |
| --- | --- | --- | --- |
| `a.pipe(b).pipe(c)` | 各 Runnable（prompt / model / parser） | 新 Runnable（链） | 固定流水线 |
| `chain.invoke(input)` | 如 `{ input: string }` | 末级输出（常为 `string`） | 一次跑完整链 |
| `chain.stream(input)` | 同上 | `AsyncIterable<chunk>` | 同链流式 |
| `chain.batch(inputs)` | 如 `[{ input }, ...]` | 结果数组 | 同链批量 |

常用解析器：

```ts
new StringOutputParser() // AIMessage → string
```

### 2.4 结构化输出：`withStructuredOutput`

| 项 | 内容 |
| --- | --- |
| **调用** | `model.withStructuredOutput(ZodSchema)` |
| **入参** | Zod schema（如 `RequirementResultSchema`） |
| **返回** | 绑定了 schema 的新模型；`invoke(messages)` 直接得到类型化对象 |
| **示例返回** | `{ action, constraints, entities }` |

适用：结果要进 API、下游或测试断言，而不是仅供人类阅读。

### 2.5 工具：`tool` / `bindTools` / 执行闭环

| API | 入参 | 返回 |
| --- | --- | --- |
| `tool(fn, { name, description, schema })` | 异步函数 + Zod 入参 schema | `StructuredTool` |
| `model.bindTools(tools)` | 工具数组 | 带工具能力的模型 |
| `tool.invoke(args)` | `toolCall.args` | 工具执行结果（任意 JSON 可序列化值） |

`AIMessage` 上关键字段：

```ts
response.tool_calls // [{ id, name, args }, ...]
```

典型闭环：

```text
messages → model.invoke
  → 若有 tool_calls：执行 tool → push ToolMessage
  → 再 invoke → 最终 content
```

业务工具示例（第四章）：`query_order` / `query_product` / `read_file` / `write_file`。

### 2.6 Memory：`RunnableWithMessageHistory` + `trimMessages`

| API | 入参 | 返回 |
| --- | --- | --- |
| `new RunnableWithMessageHistory({ runnable, getMessageHistory, inputMessagesKey, historyMessagesKey })` | 链 + 按 session 取历史的函数 + key 名 | 带会话的 Runnable |
| `withHistory.invoke({ input }, { configurable: { sessionId } })` | 当前输入 + sessionId | `AIMessage`（自动读写历史） |
| `InMemoryChatMessageHistory` | — | `.getMessages()` / `.addUserMessage` / `.addAIMessage` |
| `trimMessages({ maxTokens, strategy, tokenCounter, includeSystem, allowPartial })` | 裁剪配置 | Runnable；对 `BaseMessage[]` 裁剪后再入链 |

工程要点：`sessionId` 隔离；长对话用 `trimMessages`；生产可用 DB/Redis 替换内存实现。

### 2.7 Embeddings + Vector Store

| API | 入参 | 返回 |
| --- | --- | --- |
| `embedQuery(text)` | 单条查询文本 | `number[]`（向量） |
| `embedDocuments(docs)` | `string[]` | `number[][]` |
| `addDocuments([{ content, metadata }])` | 文档列表 | 写入向量库 |
| `similaritySearch(query, topK)` | 查询串 + TopK | 相似文档列表 |

文档侧还常用 `RecursiveCharacterTextSplitter` 切分后再嵌入。教学可用 `MemoryVectorStore`；本仓库落地偏 PostgreSQL + pgvector。

### 2.8 Multi-Agent（Fixed Workflow）

每个子 Agent ≈ `ChatPromptTemplate.pipe(model).pipe(StringOutputParser)`：

| Agent | 入参变量 | 返回（典型） |
| --- | --- | --- |
| extract | `{ input }` | JSON 字符串（orderId 等） |
| policyCheck / riskReview | `{ extractResult }` | 文本分析 |
| qa | `{ input, extractResult }` | 验收条件文本 |
| summary | 各步结果 | 最终报告 |

编排 `orchestrate(input)` 典型返回：

```ts
{
  mode: 'fixed_workflow',
  clarificationQuestions: string[],
  usedAgents: string[],
  fallback: null | 'ask_user' | 'manual_review',
  steps?: { extract, policyCheck, riskReview, qa },
  report?: string,
  status?: 'need_clarification'
}
```

流程：抽取 →（缺字段则澄清并停）→ 并行校验+风控 → QA → 汇总。

---

## 3. 两条业务主链

### 3.1 第三章：需求抽取（单轮能力链路）

```text
input
  → ChatPromptTemplate.formatMessages({ input })
  → model.withStructuredOutput(schema).invoke(messages)
  → RequirementResult
  → POST /requirement/extract
```

中间可插入：`pipe` 链做文本版；`bindTools` 做约束校验 / 实体查询。

对应代码落点（`services/api`）：

| 能力 | 文件 |
| --- | --- |
| 模型工厂 | `src/llm/model.factory.ts` |
| 提示模板 | `src/llm/prompts/requirement.prompt.ts`、`requirement.prompt-builder.ts` |
| 基础链 | `src/llm/requirement.chain.ts` |
| 结构化抽取 | `src/llm/requirement.service.ts` |
| 基础工具 | `src/llm/tools/basic.tools.ts` |

### 3.2 第四章：退货工单（多轮 + 工具 + 多 Agent）

```text
sessionId + input
  → Memory.getHistory / RunnableWithMessageHistory
  →（可选）Embeddings 语义召回政策 FAQ
  →（可选）Tools 查订单/商品/政策、写工单
  → Orchestrator：5 Agent Fixed Workflow
  → appendMessage 写回结论 + 落盘 tickets/
  → POST /api/advanced/analyze
```

对应代码落点（`services/api`）：

| 能力 | 文件 |
| --- | --- |
| Memory | `src/llm/memory/runnable-memory.service.ts` |
| 业务工具 | `src/llm/tools/business.tools.ts` |
| 文件系统闭环 | `src/llm/filesystem/filesystem.service.ts` |
| Embedding / 向量 | `src/llm/embedding/embedding.service.ts`、`vector-store.service.ts` |
| 子 Agent | `src/llm/agents/sub-agents.ts` |
| 编排 | `src/llm/agents/orchestrator.service.ts` |
| 统一入口 | `src/llm/advanced-analysis.service.ts` |

---

## 4. 选型口诀

| 场景 | 优先用 |
| --- | --- |
| 一次拿完整结果 | `invoke` |
| 前端要逐字展示 | `stream` |
| 同逻辑跑多条 | `batch` |
| 提示开始复用/失控 | `ChatPromptTemplate` |
| 步骤固定反复出现 | `pipe` 成链 |
| 结果要进程序/测试 | `withStructuredOutput` |
| 依赖外部事实/动作 | `tool` + `bindTools` |
| 多轮上下文 | `RunnableWithMessageHistory` |
| 长对话控 Token | `trimMessages` |
| 语义召回 | Embeddings + Vector Store |
| 任务分阶段分角色 | Multi-Agent Fixed Workflow |

---

## 5. 与旧归档的关系

- `01-langchain-foundations-summary.md`：旧 Nest 练习路线的第一阶段总结
- `02-langchain-concepts-and-api-guide.md`：更偏 LangChain.js 1.x 概念与 API 全景
- **本文**：对齐《AI Agents 开发实践》第三、四章的业务递进与本仓库 `services/api/src/llm` 落点
