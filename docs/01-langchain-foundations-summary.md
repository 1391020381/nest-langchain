# 第一阶段总结：LangChain.js 基础能力

本阶段对应 `src/langchain` 目录，目标是掌握模型调用和确定性 AI 流程。完成本阶段后，应先使用 Model 或 Runnable 解决问题，而不是遇到 AI 需求就直接使用 Agent。

## 1. 本阶段知识地图

```text
环境变量
  → ModelFactory
  → Chat Model
  → Messages / Prompt
  → invoke、stream、batch
  → Runnable 组合
  → Output Parser / Structured Output
  → NestJS Controller
```

涉及的主要代码：

| 文件                                    | 职责                                       |
| --------------------------------------- | ------------------------------------------ |
| `src/langchain/model.factory.ts`        | 根据配置创建 Chat Model 和 Embedding Model |
| `src/langchain/langchain.service.ts`    | 模型调用、Runnable、结构化输出和流式处理   |
| `src/langchain/langchain.controller.ts` | 将 LangChain 能力暴露为 HTTP 和 SSE 接口   |
| `src/langchain/dto/*.ts`                | 请求参数校验和接口契约                     |
| `src/langchain/langchain.module.ts`     | 注册并导出 NestJS Provider                 |

## 2. Chat Model

Chat Model 是 LangChain 中调用聊天模型的统一接口。业务代码面向统一接口编程，可以在不大幅修改业务流程的情况下更换模型或服务地址。

本项目通过 `ModelFactory` 集中创建模型：

```ts
new ChatOpenAI({
  apiKey,
  model,
  temperature,
  configuration: { baseURL },
  maxRetries: 2,
  timeout: 60_000,
});
```

关键参数：

| 参数          | 作用                                     |
| ------------- | ---------------------------------------- |
| `apiKey`      | 模型服务认证信息，不能提交到 Git         |
| `model`       | 使用的模型名称                           |
| `temperature` | 控制输出随机性，抽取和分类通常使用较低值 |
| `baseURL`     | 支持 OpenAI 兼容服务                     |
| `timeout`     | 防止模型请求无限等待                     |
| `maxRetries`  | 处理临时网络错误或限流                   |

集中创建模型的价值：

- 避免在每个 Service 中重复读取环境变量。
- 统一设置超时、重试和模型名称。
- 便于测试时替换为 Fake Model。
- 便于以后实现多模型路由。
- Controller 不需要知道模型供应商细节。

## 3. Messages

Chat Model 接收的不是简单字符串集合，而是带角色的消息序列。

常见消息类型：

| 消息            | 作用                                     |
| --------------- | ---------------------------------------- |
| `SystemMessage` | 定义模型角色、行为边界和回答规则         |
| `HumanMessage`  | 用户输入                                 |
| `AIMessage`     | 模型生成的回答，也可能包含工具调用请求   |
| `ToolMessage`   | 工具执行结果，后续 Tool Calling 阶段使用 |

示例：

```ts
const response = await model.invoke([
  new SystemMessage('你是一位严谨的 LangChain.js 学习助手。'),
  new HumanMessage(message),
]);
```

需要注意：

- System Prompt 是行为约束，不是安全边界。
- 权限检查必须由应用代码实现，不能只写在 Prompt 中。
- 多轮消息会消耗上下文窗口和 Token。
- 模型返回的 `content` 可能是字符串，也可能是内容块数组。
- Token 和模型响应信息通常可以从 `usage_metadata`、`response_metadata` 获取。

## 4. 三种调用方式

### 4.1 `invoke()`

处理单个输入并等待完整结果：

```ts
const response = await model.invoke(messages);
```

适合：

- 分类和信息抽取。
- 短文本生成。
- 后端内部任务。
- 必须得到完整结果后才能继续的流程。

### 4.2 `stream()`

返回异步迭代器，逐步产出 `AIMessageChunk`：

```ts
const stream = await model.stream(messages);

for await (const chunk of stream) {
  // 将 chunk 转换成文本后发送给客户端
}
```

适合：

- 较长的聊天回答。
- 需要降低用户感知延迟的接口。
- Agent 或工作流执行进度展示。

流式处理的关键不是简单地使用 `stream()`，而是让整条链路都支持流：

```text
模型 Chunk
  → LangChain Service
  → NestJS SSE
  → 浏览器 EventSource
```

生产环境还需要处理：

- 客户端断开连接。
- `AbortSignal` 向模型调用传递。
- 流式异常事件。
- 完成事件。
- 心跳和代理超时。

### 4.3 `batch()`

批量处理相互独立的输入：

```ts
const responses = await model.batch(inputs, {
  maxConcurrency: 5,
});
```

适合：

- 批量摘要。
- 批量分类。
- 离线数据处理。
- 评估数据集执行。

`batch()` 不等于把所有输入拼进一个 Prompt。它仍然是多个独立任务，需要通过 `maxConcurrency` 控制并发，避免触发模型服务限流。

## 5. Prompt

Prompt 的职责是把业务输入转换为模型能够稳定理解的消息。

本阶段使用了两种方式：

### 5.1 直接构造消息

```ts
[new SystemMessage('分析用户工单。'), new HumanMessage(text)];
```

适合简单、变量较少的场景。

### 5.2 `ChatPromptTemplate`

```ts
const prompt = ChatPromptTemplate.fromTemplate('从以下内容提取关键词：\n\n{text}');
```

适合：

- Prompt 包含多个变量。
- Prompt 需要复用和测试。
- Prompt 是 Runnable 流程的一部分。
- 需要清晰区分 system、human 等角色。

Prompt 设计原则：

- 明确任务目标。
- 明确输入数据边界。
- 明确不能补充不存在的事实。
- 明确输出格式。
- 不要把权限控制交给 Prompt。
- 重要 Prompt 应有版本号和回归测试。

## 6. Runnable

Runnable 是 LangChain 中统一的可组合执行接口。Prompt、Model、Parser 和自定义函数都可以作为 Runnable 参与组合。

### 6.1 `RunnableSequence`

顺序执行，每一步的输出作为下一步的输入：

```text
输入
  → Prompt
  → Model
  → StringOutputParser
  → 字符串结果
```

示例：

```ts
const chain = RunnableSequence.from([
  ChatPromptTemplate.fromTemplate('总结以下内容：\n\n{text}'),
  model,
  new StringOutputParser(),
]);
```

适合步骤明确、执行顺序固定的业务流程。

### 6.2 `RunnableParallel`

使用同一输入并行执行多个独立分支：

```text
                 ┌→ 摘要
输入 ────────────┼→ 关键词
                 └→ 内容分类
```

示例：

```ts
const parallel = RunnableParallel.from({
  summary: summarizeChain,
  keywords: keywordsChain,
});
```

适合：

- 摘要、分类、关键词等互不依赖的任务。
- 降低多个模型任务串行执行的总耗时。

并行会增加瞬时并发量和模型配额压力，需要结合限流及成本进行评估。

## 7. Output Parser 与结构化输出

### 7.1 `StringOutputParser`

将模型消息转换为普通字符串，适合摘要、翻译和自由文本生成。

### 7.2 `withStructuredOutput()`

使用 Zod Schema约束并校验模型输出：

```ts
const ticketSchema = z.object({
  category: z.enum(['account', 'system_error', 'billing', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  summary: z.string(),
  needHuman: z.boolean(),
});

const structuredModel = model.withStructuredOutput(ticketSchema);
const ticket = await structuredModel.invoke(messages);
```

优势：

- 返回值具有 TypeScript 类型。
- Zod 在运行时验证结果。
- 业务代码不需要手动解析自然语言。
- 枚举和字段约束让接口更稳定。

适合：

- 分类。
- 信息抽取。
- 路由判断。
- 生成数据库写入前的候选数据。

需要注意：

- Schema 描述要清晰，字段不要过度复杂。
- 结构化成功不代表事实正确。
- 结果仍需经过业务规则验证。
- 解析失败需要重试、降级或转人工。
- 高风险写操作不能仅凭模型结构化结果直接执行。

## 8. NestJS 与 LangChain 的边界

推荐职责分工：

| NestJS                | LangChain                     |
| --------------------- | ----------------------------- |
| Controller 和协议转换 | Model 调用                    |
| DTO 和参数校验        | Messages 与 Prompt            |
| 身份认证和权限        | Runnable 编排                 |
| 配置和依赖注入        | Output Parser                 |
| 异常过滤与日志        | Tool、Retriever、Agent、Graph |
| 数据库和事务          | AI 工作流状态                 |

推荐调用关系：

```text
Controller
  → Application Service
  → LangChain Runnable / Model
  → 外部模型服务
```

应避免：

- 在 Controller 中直接创建 `ChatOpenAI`。
- 在多个 Service 中重复读取 API Key。
- 将 LangChain 返回对象不加处理地直接暴露给客户端。
- 使用 Prompt 代替 DTO 校验、权限检查和业务规则。

## 9. 可观测性

一次模型调用至少应记录：

- 模型名称。
- Prompt 或流程版本。
- 总耗时和首 Token 延迟。
- 输入和输出 Token。
- 是否发生重试。
- 业务场景和用户反馈。
- Trace ID，但不要记录密钥和不必要的敏感数据。

RunnableConfig 中可使用：

```ts
{
  tags: ['learning', 'runnable-parallel'],
  metadata: { lesson: 1 }
}
```

`tags` 用于分类和过滤运行记录，`metadata` 用于附加业务上下文。敏感信息不应放入 metadata。

## 10. 常见误区

### 误区 1：所有 AI 流程都应该使用 Agent

步骤固定的摘要、分类、抽取和 RAG，应优先使用 Model 或 Runnable。确定性流程更容易测试、审计和控制成本。

### 误区 2：结构化输出保证答案正确

结构化输出只保证数据形状更稳定，不能保证内容真实。事实正确性仍需数据源、检索或业务规则保证。

### 误区 3：有重试就不需要超时

超时限制单次等待，重试处理临时错误。两者需要同时设置，并限制总执行时间。

### 误区 4：Streaming 会降低模型总耗时

Streaming 主要降低用户感知的等待时间，不一定减少模型完成整个回答所需的时间。

### 误区 5：System Prompt 可以防止越权

Prompt 只能影响模型行为，不能替代后端鉴权。用户身份、租户范围和数据权限必须由 NestJS 应用层控制。

## 11. 本阶段验收清单

- [x] 能创建并配置 Chat Model。
- [x] 能解释 System、Human、AI、Tool Message 的职责。
- [x] 能区分 `invoke()`、`stream()` 和 `batch()`。
- [x] 能使用 ChatPromptTemplate 管理 Prompt。
- [x] 能使用 RunnableSequence 组合顺序流程。
- [x] 能使用 RunnableParallel 组合并行流程。
- [x] 能使用 StringOutputParser 处理文本结果。
- [x] 能使用 Zod 和 `withStructuredOutput()` 生成结构化数据。
- [x] 能通过 NestJS SSE 输出模型流。
- [x] 知道 Prompt 不能代替权限和业务校验。

## 12. 进入下一阶段前需要能回答的问题

1. 为什么模型应该通过 Factory 创建？
2. `AIMessage` 和普通字符串有什么区别？
3. `invoke()`、`stream()`、`batch()` 分别适合什么场景？
4. RunnableSequence 与 RunnableParallel 有什么区别？
5. 结构化输出为什么仍然需要业务校验？
6. 为什么确定性流程应优先于 Agent？
7. 流式接口中客户端断开后应该如何停止后端任务？
8. 哪些信息可以放入 RunnableConfig 的 metadata，哪些不应该放？

如果能够脱离代码回答以上问题，并独立实现一个“输入文本 → 并行摘要和分类 → Zod 结构化输出”的接口，即可进入下一阶段：Tool Calling。
