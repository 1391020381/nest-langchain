# 第三章附录改写：逐步追源 + 注释流程代码

> 目标文件：`docs/5a-第三章附录：LangChain 编程 API 使用流程速查.md`（原地改写）  
> 前序规格：`docs/superpowers/specs/2026-08-02-ch3-langchain-api-usage-flow-design.md`（表格速查，将被本规格的读者向正文替代）  
> 代码对照：`services/api/src/llm/*`  
> 范围：LangChain 编程 API；不含 HTTP Controller

---

## 1. 目标

把附录从「对象卡 + API 表」改成：

1. **业务流程代码**（按 3.4→3.8 递进，最后拼主链）
2. **逐步追源讲解**：从 `import` / 工厂创建 → 变量 → 参数 → 返回值 → 作用
3. 明确跨文件来源（例如 `ChatOpenAI` 在 `model.factory.ts`，不在 `requirement.service.ts`）

---

## 2. 文档结构

| 节 | 内容 |
|----|------|
| 0 | 业务目标（输入/输出一句话） |
| 1 | 模型层：`createChatModel` / `ChatOpenAI` + `invoke`（stream/batch 可短注） |
| 2 | 提示层：`ChatPromptTemplate.fromMessages` + `formatMessages` / 预览 `invoke` |
| 3 | 链式层：`pipe` + `StringOutputParser` + `chain.invoke` |
| 4 | 结构化层：`withStructuredOutput` + `invoke` → `RequirementResult` |
| 5 | 工具层：`tool` + `bindTools` + `ToolMessage` 闭环 |
| 6 | **主链拼装（重点）**：按 `RequirementService.extract` 逐步追源 1→4 |
| 7 | 对照仓库路径表（每层一行） |

约束：

- 旧表格整体删除，不双轨并存
- 代码对齐仓库现状（含 `functionCalling`）
- 可做教学简化，不杜撰 API

---

## 3. 讲解规范（逐步追源）

每一步固定包含：

1. **编号步骤标题**（发生了什么）
2. **真实文件路径**（必要时跨文件追）
3. **代码片段**（贴近仓库）
4. **小表或固定四行**：`引入位置` / `创建变量` / `参数` / `返回与作用`

注释可同时使用行内四要素标签（可选，与小表不重复堆砌）：

```text
[来源] …  [参数] …  [返回] …  [作用] …
```

---

## 4. 主链样板（节 6 必须按此写透）

对照 `RequirementService.extract`。

### 步骤 1 — 模型从哪来？

业务侧：

```ts
private model = createChatModel(); // 变量 model：后续调用底座
```

真正创建在 `services/api/src/llm/model.factory.ts`：

```ts
import { ChatOpenAI } from "@langchain/openai";

export function createChatModel() {
  return new ChatOpenAI({
    model, temperature, maxTokens, openAIApiKey,
    configuration: baseURL ? { baseURL } : undefined,
  });
}
```

| 项 | 说明 |
|----|------|
| 引入 | `@langchain/openai` → `ChatOpenAI`（在 factory，**不在** service） |
| 创建 | `new ChatOpenAI(...)` → `createChatModel()` → `this.model` |
| 作用 | 统一配置；可 `invoke` / 再 `withStructuredOutput` |

### 步骤 2 — 提示模板（requirement.service.ts 约 21–24）

```ts
private prompt = ChatPromptTemplate.fromMessages([
  ["system", REQUIREMENT_SYSTEM_PROMPT],
  ["human", REQUIREMENT_USER_TEMPLATE], // 含 {input}
]);
```

| 项 | 说明 |
|----|------|
| 引入 | `@langchain/core/prompts` → `ChatPromptTemplate`；文案来自 `prompts/requirement.prompt.ts` |
| 创建 | 变量 `prompt` |
| 参数 | 角色 + 模板字符串数组 |
| 返回与作用 | `ChatPromptTemplate`；提示可维护、变量可填，尚未调模型 |

### 步骤 3 — 填变量成消息（约 L31）

```ts
const messages = await this.prompt.formatMessages({ input });
```

| 项 | 说明 |
|----|------|
| 来源 | `this.prompt`（上一步） |
| 参数 | `{ input: string }` 用户需求文本 |
| 返回 | `BaseMessage[]`（System + Human 已渲染） |
| 作用 | 变成模型可消费的消息列表 |

### 步骤 4 — 结构化并调用（约 L34–40）

```ts
const structuredModel = this.model.withStructuredOutput(
  RequirementResultSchema, // @autix/contracts
  { method: "functionCalling" }
);
return await structuredModel.invoke(messages);
```

| 项 | 说明 |
|----|------|
| 来源 | `this.model` + schema；包装为 `structuredModel` |
| 参数 | `messages`（上一步） |
| 返回 | `{ action, constraints, entities }` |
| 作用 | 完成需求抽取；结果可进程序 |

数据流一句话：

```text
createChatModel() → prompt.formatMessages({ input })
  → withStructuredOutput(schema) → invoke(messages) → RequirementResult
```

---

## 5. 递进各层（节 1–5）写法

与主链同一「逐步追源」风格，但每节只覆盖本层：

| 节 | 至少追清的变量/调用 |
|----|---------------------|
| 模型层 | `ChatOpenAI` import → `createChatModel` → `model.invoke`（附 stream/batch 差异一句） |
| 提示层 | `fromMessages` → `formatMessages` 与 `prompt.invoke`（预览）区别 |
| 链式层 | `requirementChain = prompt.pipe(model).pipe(parser)` → `chain.invoke` |
| 结构化层 | schema → `withStructuredOutput` → `invoke`（可与主链交叉引用，避免全文重复） |
| 工具层 | `tool(...)` → `bindTools` → `tool_calls` → `tool.invoke` → `ToolMessage` → 再 `invoke` |

标注：工具层为增强分支，非当前 `extract` 必经。

---

## 6. 非目标

- 不改 `services/api` 运行时代码
- 不写 HTTP 路由清单
- 不保留旧表格速查正文（路径链接可保留在文首）

---

## 7. 落地产物

| 产物 | 路径 |
|------|------|
| 本设计规格 | `docs/superpowers/specs/2026-08-02-ch3-api-cheatsheet-annotated-flow-design.md` |
| 改写目标 | `docs/5a-第三章附录：LangChain 编程 API 使用流程速查.md` |

文首保留指向课本与本规格的链接；`learning-path` 链接路径不变。
