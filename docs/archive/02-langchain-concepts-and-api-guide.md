# LangChain 思想概念与常用 API 指南

这篇文档用于在完成基础示例后建立完整的 LangChain 心智模型。重点不是记忆所有类名，而是理解每个抽象解决什么问题、何时使用，以及它与其他抽象如何组合。

本文以本项目当前使用的 LangChain.js 1.x 为准。

## 1. 先理解 LangChain 的定位

LangChain 不是一个大模型，也不是一个简单的 HTTP SDK。它提供的是一组构建 AI 应用的标准抽象：

```text
模型供应商差异
  ↓
统一的 Model / Message 接口
  ↓
Prompt、Runnable、Parser 组合
  ↓
Tool、Retriever、Agent 扩展能力
  ↓
LangGraph 管理复杂状态和工作流
  ↓
LangSmith 追踪与评估
```

适合使用 LangChain 的情况：

- 需要在不同模型供应商之间切换。
- 需要组合 Prompt、模型、解析器和自定义逻辑。
- 需要 Tool Calling、RAG 或 Agent。
- 需要流式输出、Tracing 和评估。
- 需要把 AI 流程拆成可测试、可替换的组件。

不一定需要 LangChain 的情况：

- 只有一个非常简单且稳定的模型 HTTP 请求。
- 不需要组合、工具、检索、状态或可观测性。
- 引入框架的复杂度高于业务收益。

## 2. LangChain 的核心思想

### 2.1 面向能力编程，而不是面向供应商编程

业务代码应依赖“聊天模型”“Embedding 模型”“向量库”等能力，而不是散落着 OpenAI、Anthropic 或其他供应商的专有调用。

```text
业务 Service
  → LangChain 标准接口
  → ChatOpenAI / ChatAnthropic / ChatOllama
```

这样可以降低供应商锁定，但不代表所有模型能力完全相同。Tool Calling、结构化输出、多模态和 reasoning 的支持程度仍由具体模型决定。

对应 API：

```ts
model.invoke(input);
model.stream(input);
model.batch(inputs);
model.bindTools(tools);
model.withStructuredOutput(schema);
```

### 2.2 Message 是模型上下文的标准协议

消息不只是字符串，它还包含角色、内容块、工具调用、Token 使用量和供应商响应信息。

```ts
new SystemMessage('定义模型行为');
new HumanMessage('用户输入');
new AIMessage('模型输出');
new ToolMessage({
  content: '工具结果',
  tool_call_id: 'call-id',
});
```

核心认识：

- Messages 是模型输入输出的统一表示。
- 对话历史本质上是 Message 序列。
- AIMessage 可能不含最终文本，而是要求调用工具。
- ToolMessage 必须与原始 tool call ID 对应。
- Message 内容可能是字符串，也可能是多模态内容块。

### 2.3 Prompt 是可版本化的程序配置

Prompt 不应被视为随手拼接的字符串。它定义：

- 模型扮演的角色。
- 任务目标。
- 输入数据的边界。
- 输出约束。
- 不确定时如何处理。

常用 API：

```ts
PromptTemplate.fromTemplate('总结以下内容：{text}');

ChatPromptTemplate.fromMessages([
  ['system', '你是{role}'],
  ['human', '{question}'],
]);
```

包含动态历史消息时使用：

```ts
ChatPromptTemplate.fromMessages([
  ['system', '你是一位助手'],
  new MessagesPlaceholder('history'),
  ['human', '{question}'],
]);
```

Prompt 需要像代码一样：

- 版本化。
- 测试。
- 记录变更。
- 使用固定评估集回归验证。

Prompt 不能替代权限检查、输入校验和业务规则。

### 2.4 Runnable 是统一的组合协议

Runnable 是 LangChain 最重要的基础抽象之一。一个 Runnable 通常支持：

```text
invoke   单次调用
batch    批量调用
stream   流式调用
```

Prompt、Model、Parser 和自定义函数都可以转换或表现为 Runnable，因此能够像管道一样组合。

```ts
const chain = prompt.pipe(model).pipe(new StringOutputParser());
```

等价的显式写法：

```ts
const chain = RunnableSequence.from([prompt, model, new StringOutputParser()]);
```

这体现了 LangChain 的主要思想：

> 把复杂 AI 应用拆成输入输出明确的小组件，再通过统一协议组合。

### 2.5 结构化输出是 AI 与业务系统的边界

自然语言适合与人交流，结构化数据适合进入业务系统。

```ts
const schema = z.object({
  category: z.enum(['billing', 'account', 'technical']),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
});

const structuredModel = model.withStructuredOutput(schema);
const result = await structuredModel.invoke(input);
```

结构化输出解决的是“数据形状稳定”，不保证：

- 模型事实一定正确。
- 业务判断一定正确。
- 用户具有操作权限。
- 数据可以直接写入数据库。

因此正确流程是：

```text
模型结构化输出
  → Zod 校验
  → 业务规则校验
  → 权限校验
  → 人工确认或执行
```

### 2.6 Tool 是受控的能力边界

Tool 让模型能够查询数据或执行动作。

```ts
const getOrder = tool(async ({ orderId }) => orderService.findById(orderId), {
  name: 'get_order',
  description: '查询当前用户自己的订单',
  schema: z.object({
    orderId: z.string(),
  }),
});
```

Tool 的三个核心元素：

| 元素          | 作用                         |
| ------------- | ---------------------------- |
| `name`        | 模型选择工具时使用的稳定标识 |
| `description` | 告诉模型什么情况下应该调用   |
| `schema`      | 约束并校验模型生成的参数     |

Tool 的安全原则：

- 用户身份由应用上下文注入，不接受模型提供的身份。
- 读工具和写工具分离。
- 写操作必须鉴权、确认和幂等。
- 限制超时、返回长度和调用次数。
- 不执行模型自由生成的 SQL、命令或代码。

### 2.7 Retriever 的本质是上下文工程

RAG 不是单个 API，而是一条数据和查询管线：

```text
加载文档
  → 清洗和切分
  → Embedding
  → 写入 Vector Store
  → 查询改写
  → 检索
  → 重排
  → 拼装上下文
  → 模型生成
```

核心对象：

```ts
new Document({
  pageContent: '文档内容',
  metadata: { source: 'policy.md' },
});

const chunks = await splitter.splitDocuments(documents);
await vectorStore.addDocuments(chunks);
const docs = await vectorStore.similaritySearch(query, 4);
const retriever = vectorStore.asRetriever({ k: 4 });
```

RAG 优化需要区分：

- 检索不到正确资料：Retrieval 问题。
- 检索正确但回答错误：Generation 问题。
- 找到资料但排序靠后：Ranking 问题。
- 分块破坏语义：Ingestion 问题。

### 2.8 Agent 是“模型驱动的循环”

Agent 不是更高级的 Chat Model，而是一个循环：

```text
读取当前消息
  → 模型判断下一步
  → 选择并调用工具
  → 把工具结果加入消息
  → 再次调用模型
  → 直到给出最终回答或达到停止条件
```

常用 API：

```ts
const agent = createAgent({
  model,
  tools,
  systemPrompt,
});

const result = await agent.invoke({
  messages: [{ role: 'user', content: question }],
});
```

只有步骤无法提前确定时才使用 Agent。步骤固定的任务优先使用 Runnable 或普通业务代码。

### 2.9 状态复杂后使用 LangGraph

当流程需要分支、循环、持久化、暂停审批或失败恢复时，仅靠 Agent 不容易明确控制。

LangGraph 将执行过程表示为状态图：

```text
State
  + Node
  + Edge
  + Conditional Edge
  + Checkpointer
  + Interrupt
```

LangChain 负责高层 Agent 和组件，LangGraph 负责底层、显式、可恢复的编排。

### 2.10 可观测性和评估不是上线后的附加项

传统程序的成功条件通常是“不报错”，AI 应用还需要判断“结果是否足够好”。

每次运行至少应关注：

- 输入和输出。
- Prompt 和模型版本。
- Token 与成本。
- 总耗时和首 Token 延迟。
- 工具调用轨迹。
- 检索到的文档。
- 用户反馈。
- 正确性、安全性和稳定性指标。

## 3. 包的职责

本项目使用的主要包：

| 包                         | 职责                                             |
| -------------------------- | ------------------------------------------------ |
| `langchain`                | Agent、Tool 等高层 API                           |
| `@langchain/core`          | Messages、Prompts、Runnables、Documents、Parsers |
| `@langchain/openai`        | OpenAI 与 OpenAI 兼容模型集成                    |
| `@langchain/textsplitters` | 文本切分                                         |
| `@langchain/classic`       | 部分经典 Chain、Retriever 和内存向量库实现       |
| `@langchain/langgraph`     | 状态图、Checkpoint、Interrupt 和持久执行         |

推荐导入原则：

- 基础抽象优先从 `@langchain/core/*` 导入。
- 高层 Agent 和 Tool API 从 `langchain` 导入。
- 模型从对应供应商包导入。
- 不要仅为了方便从内部深层路径导入未公开 API。

## 4. 常用 API 速查

### 4.1 Models

| API                                  | 用途                             |
| ------------------------------------ | -------------------------------- |
| `model.invoke(input, config?)`       | 单次调用并等待完整结果           |
| `model.stream(input, config?)`       | 流式获得 `AIMessageChunk`        |
| `model.batch(inputs, config?)`       | 批量处理独立输入                 |
| `model.bindTools(tools)`             | 将工具定义绑定给模型             |
| `model.withStructuredOutput(schema)` | 获取经过 Schema 校验的结构化结果 |

常见结果字段：

```ts
response.content;
response.text;
response.tool_calls;
response.usage_metadata;
response.response_metadata;
```

### 4.2 Messages

| API                        | 用途                           |
| -------------------------- | ------------------------------ |
| `SystemMessage`            | 行为和角色指令                 |
| `HumanMessage`             | 用户输入                       |
| `AIMessage`                | 模型文本、工具调用和响应元数据 |
| `AIMessageChunk`           | 流式消息片段                   |
| `ToolMessage`              | 工具执行结果                   |
| `chunk.concat(otherChunk)` | 合并流式消息片段               |

### 4.3 Prompts

| API                                 | 用途                     |
| ----------------------------------- | ------------------------ |
| `PromptTemplate.fromTemplate()`     | 单文本模板               |
| `ChatPromptTemplate.fromTemplate()` | 简单聊天模板             |
| `ChatPromptTemplate.fromMessages()` | 多角色消息模板           |
| `MessagesPlaceholder`               | 插入动态消息历史         |
| `prompt.invoke(values)`             | 将变量渲染为 PromptValue |

### 4.4 Runnables

| API                         | 用途                             |
| --------------------------- | -------------------------------- |
| `runnable.pipe(next)`       | 管道式顺序组合                   |
| `RunnableSequence.from([])` | 显式顺序组合                     |
| `RunnableParallel.from({})` | 并行执行多个分支                 |
| `RunnableLambda.from(fn)`   | 把普通函数包装成 Runnable        |
| `RunnablePassthrough`       | 保留原始输入或附加字段           |
| `RunnableBranch`            | 根据条件选择执行分支             |
| `runnable.withRetry()`      | 为 Runnable 增加重试             |
| `runnable.withFallbacks()`  | 为 Runnable 增加降级路径         |
| `runnable.withConfig()`     | 绑定 tags、metadata 等运行配置   |
| `runnable.streamEvents()`   | 获取模型、Chain、Tool 等语义事件 |

### 4.5 Output Parsers

| API                               | 用途                              |
| --------------------------------- | --------------------------------- |
| `StringOutputParser`              | 把模型消息转换为字符串            |
| `withStructuredOutput(zodSchema)` | 推荐的模型结构化输出方式          |
| `includeRaw: true`                | 同时获取原始 AIMessage 和解析结果 |

优先选择：

```text
自由文本 → StringOutputParser
业务数据 → withStructuredOutput + Zod
```

### 4.6 Documents 与 RAG

| API                              | 用途                 |
| -------------------------------- | -------------------- |
| `Document`                       | 文档内容和 metadata  |
| `RecursiveCharacterTextSplitter` | 递归文本切分         |
| `splitter.splitDocuments()`      | 将文档切成 chunks    |
| `OpenAIEmbeddings`               | 将文本转换为向量     |
| `vectorStore.addDocuments()`     | 写入文档             |
| `vectorStore.similaritySearch()` | 相似度检索           |
| `similaritySearchWithScore()`    | 检索并返回得分       |
| `vectorStore.asRetriever()`      | 转换成统一 Retriever |
| `retriever.invoke(query)`        | 执行检索             |

### 4.7 Tools 与 Agents

| API                            | 用途                             |
| ------------------------------ | -------------------------------- |
| `tool(fn, config)`             | 创建带 Schema 的工具             |
| `model.bindTools(tools)`       | 手动 Tool Calling                |
| `createAgent(options)`         | 创建预构建 Agent                 |
| `agent.invoke(state, config?)` | 执行 Agent                       |
| `agent.stream(state, config?)` | 流式执行 Agent                   |
| `responseFormat`               | 约束 Agent 最终结构化响应        |
| `middleware`                   | 在模型或工具调用周围增加控制逻辑 |

### 4.8 RunnableConfig

常用配置：

```ts
const config = {
  tags: ['support', 'production'],
  metadata: {
    promptVersion: 'ticket-v2',
  },
  maxConcurrency: 5,
  recursionLimit: 10,
  signal: abortController.signal,
  configurable: {
    thread_id: 'conversation-1',
  },
};
```

| 字段             | 用途                         |
| ---------------- | ---------------------------- |
| `tags`           | Trace 分类和过滤             |
| `metadata`       | 业务上下文和版本信息         |
| `callbacks`      | 监听运行事件                 |
| `maxConcurrency` | 控制批量或并行调用量         |
| `signal`         | 取消执行                     |
| `recursionLimit` | 限制 Agent 或 Graph 最大步数 |
| `configurable`   | thread ID 等运行时配置       |

不要把 API Key、完整身份证号等敏感信息放入 tags 或 metadata。

## 5. API 选择决策表

| 需求                   | 首选方案                 |
| ---------------------- | ------------------------ |
| 一次普通问答           | `model.invoke()`         |
| 实时显示长回答         | `model.stream()`         |
| 批量分类或摘要         | `model.batch()`          |
| 固定步骤文本处理       | `RunnableSequence`       |
| 多个互不依赖的分析任务 | `RunnableParallel`       |
| 得到可靠的数据结构     | `withStructuredOutput()` |
| 让模型建议调用哪个函数 | `bindTools()`            |
| 自动执行多轮工具循环   | `createAgent()`          |
| 基于私有文档回答       | Retriever + RAG Runnable |
| 有分支、循环和恢复要求 | LangGraph                |
| 观察调用链和评估质量   | LangSmith                |

推荐复杂度升级顺序：

```text
普通代码
  → Model
  → Model + Structured Output
  → Runnable
  → Runnable + Retriever
  → Tool Calling
  → Agent
  → LangGraph
```

不要跳级。每增加一层，能力会增强，但调试、成本和不确定性也会增加。

## 6. 五个必须掌握的组合模式

### 模式 1：Prompt → Model → String

```ts
const chain = prompt.pipe(model).pipe(new StringOutputParser());
const answer = await chain.invoke({ question });
```

用途：摘要、翻译、改写和普通问答。

### 模式 2：Model → Structured Data

```ts
const extractor = model.withStructuredOutput(schema);
const data = await extractor.invoke(messages);
```

用途：分类、抽取和路由判断。

### 模式 3：Parallel Analysis

```ts
const analysis = RunnableParallel.from({
  summary: summaryChain,
  category: categoryChain,
  risk: riskChain,
});
```

用途：对同一输入执行多个独立分析。

### 模式 4：Retrieve → Context → Generate

```text
question
  → retriever
  → documents
  → format context
  → prompt
  → model
  → answer + sources
```

用途：固定两阶段 RAG。

### 模式 5：Model ↔ Tools Loop

```text
messages
  → model.bindTools()
  → AIMessage.tool_calls
  → execute tools
  → ToolMessage
  → model
```

用途：理解 Agent 底层原理。学习阶段应先手动实现一次，再使用 `createAgent()`。

## 7. 常见混淆

### Chain 和 Runnable

Runnable 是统一执行协议；Chain 通常指由多个 Runnable 组合出的流程。LangChain 1.x 中应优先学习 Runnable 组合，而不是旧教程中的各种专用 Chain 类。

### Tool Calling 和 Agent

- Tool Calling：模型生成工具调用建议，应用负责循环和执行。
- Agent：框架封装模型、工具和循环执行。

### Structured Output 和 Tool

- Structured Output：希望得到结构化数据。
- Tool：希望模型请求应用查询或执行某种能力。

### Memory 和 Message History

- Message History：某个会话中的历史消息。
- Short-term Memory：与一个 thread 绑定的当前状态。
- Long-term Memory：跨 thread 保存的用户事实或偏好。

### Retriever 和 Vector Store

- Vector Store：保存向量并执行相似度搜索。
- Retriever：面向查询返回 Documents 的统一接口，可以使用向量库，也可以使用关键词、数据库或混合检索。

## 8. 推荐练习

### 练习 1：模型能力矩阵

使用相同测试集比较两个模型：

- 普通问答质量。
- 结构化输出成功率。
- Tool Calling 参数正确率。
- Streaming 首 Token 延迟。
- Token 和成本。

项目实践入口：[进阶练习 1：模型能力矩阵](exercises/01-model-capability-matrix.md)

### 练习 2：Runnable 组合

实现：

```text
输入文本
  → 并行执行摘要、分类、风险判断
  → 合并为统一结构化结果
```

要求使用：

- `ChatPromptTemplate`
- `RunnableParallel`
- `withStructuredOutput`
- `tags` 和 `metadata`

### 练习 3：手动 Tool Calling

不使用 `createAgent()`，手动完成：

1. `model.bindTools(tools)`。
2. 读取 `AIMessage.tool_calls`。
3. 执行对应工具。
4. 创建 `ToolMessage`。
5. 再次调用模型。

### 练习 4：最小 RAG

实现：

1. 创建 Documents。
2. 文本切分。
3. Embedding。
4. 写入 Vector Store。
5. Retriever 查询。
6. 带来源生成回答。

### 练习 5：故障和降级

为一个 Runnable 增加：

- 超时和取消。
- 最大并发。
- 重试。
- Fallback 模型。
- Trace tags。

## 9. 掌握标准

如果能脱离文档回答以下问题，说明已经形成基础心智模型：

1. LangChain 解决的核心问题是什么？
2. 为什么 Message 不是普通字符串？
3. Runnable 统一了哪些执行方式？
4. 什么情况下使用 Sequence、Parallel 和 Branch？
5. 为什么结构化输出之后还需要业务校验？
6. Tool 的 Schema、描述和安全边界分别解决什么问题？
7. Retriever 和 Vector Store 有什么区别？
8. Tool Calling 和 Agent 有什么区别？
9. 什么情况下不应该使用 Agent？
10. 什么时候从 LangChain Agent 升级为 LangGraph？
11. 如何取消一个正在 Streaming 的请求？
12. 如何证明更换 Prompt 或模型后效果变好了？

## 10. 官方参考资料

- [LangChain JavaScript Overview](https://docs.langchain.com/oss/javascript/langchain/overview)
- [Models](https://docs.langchain.com/oss/javascript/langchain/models)
- [Messages](https://docs.langchain.com/oss/javascript/langchain/messages)
- [Tools](https://docs.langchain.com/oss/javascript/langchain/tools)
- [Structured Output](https://docs.langchain.com/oss/javascript/langchain/structured-output)
- [Streaming](https://docs.langchain.com/oss/javascript/langchain/streaming)
- [JavaScript API Reference](https://reference.langchain.com/javascript/)
