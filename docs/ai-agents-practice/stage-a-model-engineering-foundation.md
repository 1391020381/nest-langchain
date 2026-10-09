# 阶段 A 实施记录：模型与工程基础

本文是 [`AIAgents开发实践.md`](../AIAgents开发实践.md) 阶段 A 的实践产物，覆盖序章、第一章、第二章和第 2.5 章。它记录规格、实现映射、验证方式和学习证据，不代替章后问答。

## 1. 目标与边界

目标：实现一条可复用、可验证的“需求文本 → 结构化需求”能力链，并通过 Web 与 NestJS API 对外提供。

本阶段包含：

- 共享的输入与输出 Schema；
- Prompt、模型参数、结构化输出与错误边界；
- Web → HTTP → NestJS → Model → HTTP → Web 的最小链路；
- 离线测试、类型检查、构建和启动脚本；
- 可用于 LangSmith Trace 检查的模型调用。

本阶段不包含 Tool Calling、Memory、RAG、LangGraph 或 DeepAgent。这些能力在后续阶段逐步引入，避免把“单次模型能力”和“Agent 循环”混为一谈。

## 2. 能力分层图

```text
用户输入自然语言
  │ input: string
  ▼
Web 页面（clients/web）
  │ RequirementSchema 校验并发送 JSON
  ▼
NestJS Controller（services/api）
  │ 再次校验不可信的网络输入
  ▼
RequirementService
  │ SystemMessage + HumanMessage
  ▼
Chat Model
  │ 候选结构化对象
  ▼
RequirementResultSchema
  │ 拒绝缺字段、错类型和额外字段
  ▼
HTTP JSON 响应
  │ 前端再次校验响应
  ▼
页面渲染 action / constraints / entities
```

| 层 | 输入 | 输出 | 决策或责任主体 |
| --- | --- | --- | --- |
| Web | 用户文本 | 合法请求 JSON | 前端代码与共享 Schema |
| Controller | 不可信 HTTP body | 已校验的 input | NestJS 与共享 Schema |
| Prompt | input | System/Human Messages | 应用代码 |
| Model | Messages、模型参数、输出 Schema | 候选结构化对象 | 模型生成 |
| Output boundary | 候选对象 | `RequirementResult` 或错误 | 共享 Schema 与服务代码 |
| UI | 已校验响应 | 可见结果 | React 组件 |

模型只负责生成候选结果。输入校验、模型调用、结果验收、HTTP 状态和页面渲染都由确定性代码负责。

## 3. 契约与失败策略

### 输入契约

- `input` 必须是字符串；
- 去除首尾空白后不能为空；
- 最长 4000 个字符；
- 拒绝未声明字段。

### 输出契约

- `action` 是非空字符串；
- `constraints` 与 `entities` 是非空字符串数组，可以为空数组；
- 拒绝缺少字段、字段类型错误和未声明字段。

### 失败策略

| 失败 | 行为 | 原因 |
| --- | --- | --- |
| 浏览器输入非法 | 不发送请求，显示错误 | 尽早反馈 |
| HTTP body 非法 | 返回 400 | 网络输入不可被信任 |
| Provider 调用失败 | 返回脱敏后的 500 | 不向客户端泄露 Provider 细节 |
| 模型结果不符合 Schema | 返回 500，不进入业务层 | Prompt 不是安全边界 |
| 前端收到非法响应 | 不渲染并显示错误 | 防止服务端漂移污染 UI |

当前能力不自动重试。结构化抽取不是可重复产生副作用的操作，但盲目重试仍可能放大延迟和成本；重试、退避和降级应在获得明确 SLO 后配置。

## 4. 实现映射

| 产物 | 位置 |
| --- | --- |
| 共享输入/输出 Schema | `packages/contracts/src/index.ts` |
| Prompt | `services/api/src/llm/prompts/requirement.prompt.ts` |
| 模型配置与创建 | `services/api/config/langchain.yaml`、`services/api/src/llm/model.factory.ts` |
| 能力封装及错误处理 | `services/api/src/llm/requirement.service.ts` |
| HTTP 边界 | `services/api/src/app.controller.ts` |
| Web 调用和响应校验 | `clients/web/app/page.tsx` |
| 离线验证 | `packages/contracts/test/requirement.schema.spec.ts`、`services/api/test/requirement.spec.ts` |

## 5. 一键运行与任务边界

```bash
# API :3001 + Web :3000
bun run dev:stage-a

# 只运行阶段 A 的离线测试，不调用真实模型
bun run test:stage-a

# 类型检查
bun run typecheck:stage-a

# 生产构建
bun run build:stage-a
```

复制 `services/api/.env.example` 和 `clients/web/.env.example` 中需要的配置到本地 `.env`。密钥只能进入环境变量，不能进入 Prompt、代码、日志、Trace 或提交记录。

真实模型验证是显式选择：

```bash
# macOS / Linux
RUN_LIVE_LLM_TESTS=1 bun test services/api/test/requirement.spec.ts
```

```powershell
# Windows PowerShell
$env:RUN_LIVE_LLM_TESTS = "1"
bun test --cwd services/api test/requirement.spec.ts
Remove-Item Env:RUN_LIVE_LLM_TESTS
```

默认测试不因为本机恰好存在 API Key 就访问外部 Provider，从而保证干净环境下结果可复现。

## 6. LangSmith Trace 检查表

在页面提交一次请求后，打开对应模型 Run：

1. **模型收到哪些消息？** `input.messages` 应包含一个 SystemMessage 和一个 HumanMessage；用户原文只能出现在 HumanMessage 的模板变量位置。
2. **暴露了哪些工具？** 本阶段应为零。结构化输出可能在 Provider 层表现为函数定义，但它用于输出约束，不是由应用执行的业务 Tool。
3. **工具参数由谁生成？** 本阶段不执行 Tool。结构化字段由模型生成，再由 Zod 验证。
4. **执行后返回了什么？** 没有 ToolMessage；模型 Run 的 output 应能解析为 `action`、`constraints`、`entities`。
5. **为什么停止？** 这是一次模型调用，不存在 Agent loop。模型完成结构化输出后停止；应用验证通过就返回，验证失败就抛错。

建议保存 run URL 或 runId，并记录模型名、temperature、Prompt 版本、输入、输出、token usage 和 `finish_reason`。不要把推测当成 Trace 证据。

## 7. Spec → Plan → 实施 → 验证记录

### Spec

- 使用现有 monorepo，不另建重复项目；
- Web 和 API 共用 Zod Schema；
- 模型输出必须经过程序校验；
- 离线测试不得隐式请求真实模型；
- 不在阶段 A 提前引入 Agent、Tool 或 Memory。

### Plan

1. 收紧共享输入/输出契约；
2. 在服务层建立输入、Provider、输出三类失败边界；
3. 在 Controller 和 Web 两端应用共享 Schema；
4. 添加确定性的离线测试和阶段脚本；
5. 保存架构、Trace 和验收说明。

### 验收证据

- `bun run test:stage-a`：契约、Prompt、模型工厂和能力边界测试；
- `bun run typecheck:stage-a`：四个相关 workspace 类型一致；
- `bun run build:stage-a`：NestJS 与 Next.js 可生产构建；
- 页面手工验证：合法输入返回结构化字段，空输入在客户端失败；
- LangSmith：保存一次真实调用 Run，按上一节回答五个问题。

本次实施验证（2026-09-29）：离线测试 9 项通过、1 项 live test 按设计跳过；四个 workspace 类型检查通过；生产构建 4 个任务通过；`bun run dev:stage-a` 启动后，`GET http://localhost:3001/health` 返回 `{ "ok": true }`，`GET http://localhost:3000` 返回 HTTP 200。

## 8. 尚需学习者完成

- 阅读阶段 A 四章正文；
- 完成一次真实 Provider + LangSmith Trace 验证；
- 回答学习 Path 中四组章后问题；
- 达到 80/100 且没有关键误解后，才勾选“问答”和“验收”。

