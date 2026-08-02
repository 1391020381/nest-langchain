# 第三章附录：LangChain 编程 API 使用流程速查

> 配套课本：[5-第三章：LangChain 起手——搭建第一条服务端能力链路](./AI%20Agents%20开发实践/5-第三章：LangChain%20起手——搭建第一条服务端能力链路.md)  
> 设计规格：[逐步追源改写 spec](./superpowers/specs/2026-08-02-ch3-api-cheatsheet-annotated-flow-design.md)  
> 代码落点：`services/api/src/llm/*`  
> 范围：**LangChain 编程 API**（不含 HTTP Controller）  
> 读法：每步追清「引入位置 → 创建变量 → 参数 → 返回与作用」

---

## 0. 业务目标

| 输入 | 输出 |
|------|------|
| 需求文本，例如「用户注册时必须绑定手机号，密码至少8位」 | `{ action, constraints, entities }` |

正式入口：`RequirementService.extract`。下面先按 3.4→3.8 递进，再在第 6 节把主链拼完整。

---

## 1. 模型层（3.4）

### 步骤 1.1 — `ChatOpenAI` 从哪引入、如何创建？

文件：`services/api/src/llm/model.factory.ts`

```ts
import { ChatOpenAI } from "@langchain/openai"; // 包：@langchain/openai

export function createChatModel() {
  const config = loadLangChainConfig(); // YAML：model / temperature / maxTokens
  const keys = getApiKeys();            // 环境变量：OPENAI_API_KEY / baseURL

  // [返回] ChatOpenAI 实例
  // [作用] 统一模型入口，业务代码不要直接 new ChatOpenAI
  return new ChatOpenAI({
    model: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
    openAIApiKey: keys.openaiApiKey,
    configuration: keys.openaiBaseUrl
      ? { baseURL: keys.openaiBaseUrl }
      : undefined,
  });
}
```

| 项 | 说明 |
|----|------|
| 引入位置 | `@langchain/openai` → `ChatOpenAI`（**在 factory，不在 Service**） |
| 创建变量 | `createChatModel()` 的返回值；业务里常写成 `private model = createChatModel()` |
| 参数 | 配置来自 YAML + 环境变量，无业务侧显式入参 |
| 返回与作用 | `ChatOpenAI`；后续 `invoke` / `stream` / `batch` / `withStructuredOutput` / `bindTools` 的底座 |

### 步骤 1.2 — 单次调用 `invoke`

文件：`services/api/src/llm/llm.service.ts`（`invokeDemo`）

```ts
import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { createChatModel } from "./model.factory";

private model = createChatModel(); // 变量 model ← 上一步工厂

async invokeDemo(input: string): Promise<string> {
  // [创建] messages：模型可读的对话列表
  const messages: BaseMessage[] = [
    new SystemMessage("你是一名需求结构化抽取助手"),
    new HumanMessage(`请抽取 action、constraints、entities：\n${input}`),
  ];

  // [来源] this.model.invoke
  // [参数] messages: BaseMessage[]
  // [返回] AIMessage；业务取 content 字符串
  // [作用] 单次完整调用，拿到自由文本
  const response = await this.model.invoke(messages);
  return response.content.toString();
}
```

| 项 | 说明 |
|----|------|
| 引入位置 | `@langchain/core/messages` → `SystemMessage` / `HumanMessage` |
| 创建变量 | `messages`；调用结果 `response` |
| 参数 | `BaseMessage[]` |
| 返回与作用 | `AIMessage` → 字符串；默认主形态 |

`stream` / `batch` 同一 `model`，差异一句：`stream` 返回 chunk 流（边生成边展示）；`batch` 吃 `BaseMessage[][]`，一次跑多条。

---

## 2. 提示层（3.5）

### 步骤 2.1 — 创建模板对象

文件：`services/api/src/llm/requirement.prompt-builder.ts`（演示链用）  
正式业务同类写法在 `requirement.service.ts`。

```ts
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  REQUIREMENT_SYSTEM_PROMPT,
  REQUIREMENT_USER_TEMPLATE, // 含占位符 {input}
} from "./prompts/requirement.prompt";

// [创建] requirementPrompt：可填充、可 format、可 pipe
export const requirementPrompt = ChatPromptTemplate.fromMessages([
  ["system", REQUIREMENT_SYSTEM_PROMPT],
  ["human", REQUIREMENT_USER_TEMPLATE],
]);
```

| 项 | 说明 |
|----|------|
| 引入位置 | `@langchain/core/prompts` → `ChatPromptTemplate`；文案来自 `prompts/requirement.prompt.ts` |
| 创建变量 | `requirementPrompt`（或 Service 内 `this.prompt`） |
| 参数 | 角色 + 模板字符串数组 |
| 返回与作用 | `ChatPromptTemplate`；提示可维护，**尚未调模型** |

### 步骤 2.2 — 预览 vs 转成消息

```ts
// 只渲染，不调模型 —— 调试提示用
const promptValue = await requirementPrompt.invoke({ input });
// [返回] PromptValue；可 .toString() 看渲染结果

// 转成模型可消费的消息 —— 真正调用前用这个
const messages = await requirementPrompt.formatMessages({ input });
// [参数] { input: string }
// [返回] BaseMessage[]
// [作用] 填好 {input}，交给 model.invoke / structuredModel.invoke
```

| 调用 | 返回 | 作用 |
|------|------|------|
| `prompt.invoke({ input })` | `PromptValue` | 预览渲染 |
| `prompt.formatMessages({ input })` | `BaseMessage[]` | 进入模型调用 |

---

## 3. 链式层（3.6）

文件：`services/api/src/llm/requirement.chain.ts`

```ts
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createChatModel } from "./model.factory";
import { requirementPrompt } from "./requirement.prompt-builder";

const model = createChatModel();              // ChatOpenAI
const parser = new StringOutputParser();     // AIMessage → string

// [创建] requirementChain：固定流水线
// prompt → model → parser
export const requirementChain = requirementPrompt
  .pipe(model)
  .pipe(parser);
```

调用（`llm.service.ts`）：

```ts
// [参数] { input }，对齐模板变量名
// [返回] string（已被 StringOutputParser 收束）
// [作用] 一次跑完「模板→模型→字符串」，不必每次手写三步
const result = await requirementChain.invoke({ input });
```

| 项 | 说明 |
|----|------|
| 引入位置 | `@langchain/core/output_parsers` → `StringOutputParser` |
| 创建变量 | `parser`、`requirementChain` |
| 参数 | `chain.invoke({ input })` |
| 返回与作用 | `string`；演示/中间形态。正式 `extract` **不用**这条字符串链，而用结构化输出 |

同链还可 `stream` / `batch`，只改返回方式，不改步骤顺序。

---

## 4. 结构化输出层（3.7）

### 步骤 4.1 — Schema 从哪来？

文件：`packages/contracts/src/index.ts`

```ts
import { z } from "zod";

export const RequirementResultSchema = z.object({
  action: z.string(),
  constraints: z.array(z.string()),
  entities: z.array(z.string()),
});
export type RequirementResult = z.infer<typeof RequirementResultSchema>;
```

| 项 | 说明 |
|----|------|
| 引入位置 | 业务侧 `@autix/contracts` → `RequirementResultSchema` |
| 创建变量 | schema 本身（类型 `RequirementResult`） |
| 作用 | 约定程序可消费、可断言的字段形状 |

### 步骤 4.2 — 包装模型并调用

详见第 6 节步骤 4。核心两行：

```ts
const structuredModel = this.model.withStructuredOutput(
  RequirementResultSchema,
  { method: "functionCalling" } // 本仓库兼容接口上比 jsonMode 更稳
);
return await structuredModel.invoke(messages); // → RequirementResult
```

---

## 5. 工具层（3.8）— 增强分支，非 `extract` 必经

### 步骤 5.1 — 定义工具

文件：`services/api/src/llm/tools/basic.tools.ts`

```ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// [创建] checkConstraintValidityTool：可被模型点名调用的函数
export const checkConstraintValidityTool = tool(
  async ({ constraint }) => {
    const passed = /必须|至少|不得|不能/.test(constraint);
    return { constraint, passed, reason: passed ? "命中明确约束模式" : "不属于明确约束表达" };
  },
  {
    name: "check_constraint_validity",
    description: "校验一条约束是否属于明确约束表达",
    schema: z.object({ constraint: z.string() }),
  }
);
```

| 项 | 说明 |
|----|------|
| 引入位置 | `@langchain/core/tools` → `tool` |
| 创建变量 | `checkConstraintValidityTool` / `lookupEntityDefinitionTool` |
| 参数 | `schema` 约束入参；`name`/`description` 给模型选工具用 |
| 返回与作用 | 确定性结果（校验/查询），不是模型“编”的 |

### 步骤 5.2 — 绑定与闭环

文件：`llm.service.ts`（`toolLoopDemo`）

```ts
// [创建] modelWithTools：会“声明” tool_calls 的模型
const modelWithTools = this.model.bindTools([
  checkConstraintValidityTool,
  lookupEntityDefinitionTool,
]);

const firstResponse = await modelWithTools.invoke(messages);
// [返回] AIMessage，可能带 tool_calls: { name, args, id }[]
// [作用] 模型只声明要调谁；此时工具尚未执行

for (const toolCall of firstResponse.tool_calls ?? []) {
  const toolResult = await toolMap[toolCall.name].invoke(toolCall.args);
  // [返回] 工具函数的真实结果

  messages.push(
    new ToolMessage({
      tool_call_id: toolCall.id!,
      content: JSON.stringify(toolResult),
    })
  );
  // [作用] 把执行结果写回对话，供下一轮推理
}

const finalResponse = await modelWithTools.invoke(messages);
// [返回] 结合工具结果后的最终答复
```

分工：模型决定是否调用；工具给确定性结果。`toolBindDemo` 只看到 `tool_calls`，不执行工具。

---

## 6. 主链拼装（重点）— `RequirementService.extract`

文件：`services/api/src/llm/requirement.service.ts`

数据流：

```text
createChatModel()
  → prompt.formatMessages({ input })
  → withStructuredOutput(schema)
  → structuredModel.invoke(messages)
  → RequirementResult
```

### 步骤 1 — 模型从哪来？

业务侧（**这里没有** `import { ChatOpenAI }`）：

```ts
import { createChatModel } from "./model.factory";

private model = createChatModel(); // 变量 model：后续调用底座
```

真正创建追到 `model.factory.ts`（见第 1 节）：

```ts
import { ChatOpenAI } from "@langchain/openai";
return new ChatOpenAI({ /* 配置 */ });
```

| 项 | 说明 |
|----|------|
| 引入位置 | `ChatOpenAI` ← `@langchain/openai`（factory）；Service 只引入 `createChatModel` |
| 创建变量 | `this.model` |
| 作用 | 统一配置的聊天模型实例 |

### 步骤 2 — 提示模板（约 L21–24）

```ts
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  REQUIREMENT_SYSTEM_PROMPT,
  REQUIREMENT_USER_TEMPLATE,
} from "./prompts/requirement.prompt";

private prompt = ChatPromptTemplate.fromMessages([
  ["system", REQUIREMENT_SYSTEM_PROMPT],
  ["human", REQUIREMENT_USER_TEMPLATE], // 含 {input}
]);
// 变量 prompt：负责角色 + 用户模板，尚未调模型
```

| 项 | 说明 |
|----|------|
| 引入位置 | `@langchain/core/prompts`；文案 `prompts/requirement.prompt.ts` |
| 创建变量 | `this.prompt` |
| 参数 | 角色 + 模板字符串数组 |
| 返回与作用 | `ChatPromptTemplate`；提示可控、变量可填 |

### 步骤 3 — 填变量成消息（约 L31）

```ts
const messages = await this.prompt.formatMessages({ input });
// [来源] this.prompt
// [参数] { input: 用户需求文本 }
// [返回] BaseMessage[]（System + Human 已渲染）
// [作用] 变成模型能吃的消息列表
```

| 项 | 说明 |
|----|------|
| 创建变量 | `messages` |
| 参数 | `{ input: string }` |
| 返回与作用 | `BaseMessage[]`；供下一步 `invoke` |

### 步骤 4 — 结构化并调用（约 L34–40）

```ts
import {
  RequirementResultSchema,
  type RequirementResult,
} from "@autix/contracts";

const structuredModel = this.model.withStructuredOutput(
  RequirementResultSchema,
  { method: "functionCalling" }
);
// [创建] structuredModel：包装后的模型，invoke 直接吐对象而不是自由文本

return await structuredModel.invoke(messages);
// [参数] 上一步 messages
// [返回] RequirementResult：{ action, constraints, entities }
// [作用] 完成需求抽取，结果可进 API / 前端 / 测试
```

| 项 | 说明 |
|----|------|
| 引入位置 | schema ← `@autix/contracts`；方法来自 `this.model` |
| 创建变量 | `structuredModel`；返回值即业务结果 |
| 参数 | `messages` |
| 返回与作用 | 稳定 JSON 字段，程序可消费 |

---

## 7. 对照仓库路径

| 层 | 路径 |
|----|------|
| 模型工厂 | `services/api/src/llm/model.factory.ts` |
| 提示文案 | `services/api/src/llm/prompts/requirement.prompt.ts` |
| 提示 builder（演示） | `services/api/src/llm/requirement.prompt-builder.ts` |
| 字符串链（演示） | `services/api/src/llm/requirement.chain.ts` |
| 演示方法集合 | `services/api/src/llm/llm.service.ts` |
| 工具定义 | `services/api/src/llm/tools/basic.tools.ts` |
| **业务主链** | `services/api/src/llm/requirement.service.ts` |
| 结果 Schema | `packages/contracts/src/index.ts` |

---

## 一句话记忆

**`ChatOpenAI` 在 factory 里创建 → `prompt` 管输入模板 → `formatMessages` 变成消息 → `withStructuredOutput` 约束输出 → `invoke` 得到业务 JSON；工具层是可选增强，不是当前 `extract` 必经。**
