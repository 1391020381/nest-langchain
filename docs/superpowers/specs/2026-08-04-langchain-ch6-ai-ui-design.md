# Design: 第六章——让 AI 做更懂你的交互（AI 驱动 UI）

**Date:** 2026-08-04  
**Status:** Approved for implementation planning  
**Source:** `docs/AI Agents 开发实践/8-第六章：让 AI 做更懂你的交互.md`  
**Branch:** `feat/LangChain-Advanced-UI`  
**Reference:** [Cookieboty/autix-demo `feat/ai-ui`](https://github.com/Cookieboty/autix-demo/tree/feat/ai-ui)（协议类型、Zod、前端组件结构；主路径不照搬其确定性状态机）

## Goal

把模型输出从纯文本升级为前端可渲染的 **UI 协议**，并打通完整交互闭环：

1. 在 `services/chat` 落地 UI 响应协议（types + Zod + Structured Output）。
2. 独立 `/api/ui-chat`（JWT + Conversation/Message 持久化），与现有纯文本 chat 并存。
3. **LLM 主导**决定返回哪些组件；用户 `UIAction` 结构化回传。
4. 确认分析时调用现有 `orchestrate`，经适配器映射为 UI 组件。
5. 分析阶段支持 **text streaming + component batching**（SSE）。
6. 在 `clients/chat-web` 实现 ComponentRenderer 与 AIChatContainer。

主验收入口：

`POST /api/ui-chat/:conversationId/chat|action`（同步 UI）  
`POST /api/ui-chat/:conversationId/analyze/stream`（SSE：progress / markdown / ui / done）

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | 整章 6.2–6.5 一次设计/实现 |
| Approach | 方案 1：UI 协议层 + LLM 编排壳 + Orchestrator 适配（不重写 Agent 内核） |
| API surface | 独立 `/api/ui-chat/*`，与 `POST /api/conversations/:id/chat` 并存 |
| Flow driver | **LLM Structured Output 主导**（非 feat/ai-ui 主路径的确定性状态机） |
| Reference use | 借鉴协议 / Schema / 前端组件；chat/action 不走纯状态机 |
| Auth / session | JWT；`conversationId` = Conversation.id；校验归属 |
| Persistence | Message.content + metadata（ui / action / context）；不改 Prisma schema |
| Analyze backend | 确认后调用现有 `packages/llm-core` `orchestrate`，再映射 UI |
| Streaming | 完整 text streaming + component batching；普通 chat/action 同步，分析走 SSE |
| Frontend | `clients/chat-web` 移植并适配 feat/ai-ui 组件层 |
| Orchestrator semantics | 保持现有订单/售后固定工作流；用 Adapter 把澄清/报告映射到 UI（本迭代不重写为「需求分析 Multi-Agent」） |
| Out of scope | 重写 Multi-Agent 业务语义、改 Ch5 文档 Pipeline、改文档处理 SSE、完整 RBAC、独立向量库 |

## Architecture

```
clients/chat-web (:3002)
  AIChatContainer + ComponentRenderer (+ SSE client)
        │ JWT
        ▼
services/chat (:4001)
├─ AuthModule / PrismaModule / ConversationModule（复用）
├─ UiProtocolModule（新增）
│   ├─ ui-types.ts / ui-schemas.ts
│   ├─ UIResponseService      withStructuredOutput → AIUIResponse
│   ├─ UIActionService        UIAction → 下一步（LLM 或转 Adapter）
│   ├─ UIOrchestrateAdapter   collectedData → orchestrate → UI 映射
│   ├─ UIValidate / post-process
│   └─ UIChatController
│        POST /api/ui-chat/:conversationId/chat
│        POST /api/ui-chat/:conversationId/action
│        POST /api/ui-chat/:conversationId/analyze/stream
└─ 现有 /api/conversations/:id/chat、/api/sse（文档进度）保持不变
        │
        ▼
packages/llm-core.orchestrate（内核不改；仅 chat 侧适配输出）
```

### End-to-end flows

**同步交互（选择 / 表单 / 一般确认）：**

```
JWT → create Conversation（若无）
  → POST .../chat { input }
       load messages → UIResponseService → validate → persist → AIUIResponse
  → POST .../action { action }
       persist human(action) → UIResponseService(context) → persist ai
```

**分析流式（用户确认提交分析）：**

```
POST .../action { confirm: true }
  → persist + 返回 { streamSuggested: true }（不跑 orchestrate）
POST .../analyze/stream
  → UIOrchestrateAdapter
       progress events（可占位）
       orchestrate() 完成 → markdown（可一次）+ 映射 components
       ui 整包 → done → 一次性落库
```

> 注：当前 `orchestrate` 为非流式函数。首版 progress 可为「阶段占位事件」+ 完成后推 markdown/ui；若后续 `llm-core` 暴露流式，再换成真实 token 流。协议与前端按完整流式设计，避免二次改契约。

## Protocol

### Component types

`text` | `selection` | `form` | `confirmation` | `card` | `steps` | `table` | `action_buttons`

对齐 feat/ai-ui 的 TypeScript 与 Zod（`z.discriminatedUnion('type', ...)`）。

### Envelope types

```ts
interface AIUIResponse {
  version: '1.0';
  message: string;
  components: UIResponse[];
  context?: {
    sessionStage?: string;
    collectedData?: Record<string, unknown>;
  };
}

interface UIAction {
  componentType: UIResponse['type'];
  payload:
    | { type: 'select'; selectedId: string | string[] }
    | { type: 'submit'; formData: Record<string, unknown> }
    | { type: 'confirm'; confirmed: boolean }
    | { type: 'click'; actionId: string }
    | { type: 'row_select'; rowIndex: number };
}

interface StreamMessage {
  messageType: 'markdown' | 'ui' | 'progress' | 'meta' | 'done' | 'error';
  timestamp: string;
  payload:
    | { content: string; isChunk: boolean; messageId?: string } // markdown
    | { messageId: string; components: UIResponse[]; thinking?: string } // ui
    | { step: number; totalSteps: number; agent?: string; status: 'started' | 'completed' | 'failed' } // progress
    | { message: string } // error
    | null; // done / meta
}
```

**确认分析触发约定（写死）：**

- `POST .../action` 若 `action.payload.type === 'confirm' && confirmed === true`：**不**调用 `orchestrate`；返回 `{ ...AIUIResponse, streamSuggested: true }`（message 可提示「开始分析」；components 可为空或仅 steps pending）。
- 前端收到 `streamSuggested: true` 后必须再调 `POST .../analyze/stream`；**只有**该端点调用 `UIOrchestrateAdapter` / `orchestrate`。
- `confirmed === false`：走普通 LLM 下一步（回到表单/选择），同步返回，无 SSE。

### Post-process rules

1. `message` 为空 → 兜底文案（如「正在为您处理...」）。
2. 过滤 `selection.options.length < 2`、空 `form.fields`。
3. `components.length > 5` → 截断为 5。
4. Structured Output / 提供商失败 → 降级为单个 `text` 组件，HTTP 200（不 500）。
5. 未知组件类型仅前端 fallback；后端 Schema 不允许未知 type 出站。

### Persistence mapping

| Role | content | metadata |
|------|---------|----------|
| human（文本） | 用户原文 | 可选 |
| human（UI 操作） | `[UI 操作: {componentType} → {payload.type}]` | `{ action: UIAction }` |
| ai | `AIUIResponse.message` | `{ ui: AIUIResponse }` |

`context.collectedData`：写入最新 ai `metadata.ui.context`；下次请求从历史末条 ai 的 context 合并还原（不新增表字段）。

## API

全部需 `JwtAuthGuard`；`conversationId` 必须属于当前用户。

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/ui-chat/:conversationId/chat` | `{ input: string }` | `AIUIResponse` |
| POST | `/api/ui-chat/:conversationId/action` | `{ action: UIAction }` | `AIUIResponse & { streamSuggested?: boolean }`（仅 confirm=true 时 `streamSuggested: true`） |
| POST | `/api/ui-chat/:conversationId/analyze/stream` | 可选 `{ note?: string }`；上下文从 DB messages / collectedData 读取 | SSE `StreamMessage` 流 |

现有接口不变：

- `POST /api/conversations/:id/chat` → 纯文本 `AnalyzeService`
- `GET /api/sse` → 文档处理进度

## Services

### UIResponseService

- System Prompt：需求分析助手 + 组件选择指南（何时用 selection/form/confirmation/card/...）。
- `model.withStructuredOutput(aiUIResponseSchema)`。
- 输入：user text、DB 历史摘要、merged `collectedData`。

### UIActionService

- 将 `UIAction` 转为结构化提示（含 selectedId / formData / confirmed）。
- 合并并持久化 `collectedData`。
- `confirm === true` → **不**调 orchestrate；返回带 `streamSuggested: true` 的响应。
- 其他操作 → 再调 `UIResponseService`。

### UIOrchestrateAdapter

1. 用 `collectedData` + 近期消息拼成 `orchestrate(input)` 字符串。
2. 调用 `orchestrate`（不改 llm-core）。
3. 映射规则：
   - `status === 'need_clarification'` → `selection` 或 `form`（问题列表）。
   - 有 `report` → `steps`（按 `usedAgents`）+ `card`（摘要字段）+ `action_buttons`（后续操作）+ `message`/`markdown` 放报告正文。
   - `error` / fallback → `text` + 可选 `action_buttons`（重试）。
4. 可选：对报告再跑一次 Structured Output 精修 components（失败则用手写映射结果）。

## Frontend (`clients/chat-web`)

移植并适配参考分支：

- `types/ui-types.ts`
- `components/ai-ui/ComponentRenderer.tsx` 及 SelectionCard / DynamicForm / ConfirmationDialog / InfoCard / StepsProgress / DataTable / ActionButtons
- `AIChatContainer`：JWT、Conversation 选择/创建、同步 chat/action、分析 SSE
- `streamingMessage` 与 `messages` 状态分离
- 未知 `type` → `[不支持的组件类型: ...]`
- 环境变量：`NEXT_PUBLIC_API_BASE_URL`（指向 chat `:4001`）

样式：可用轻量 Tailwind；不强制 shadcn。交互完整优先于视觉精致。

## Error handling

| Case | Behavior |
|------|----------|
| 无 JWT | 401 |
| Conversation 非本人 / 不存在 | 404 |
| input 空 | 400 |
| Structured Output 失败 | text 降级 + 日志 |
| SSE 中断 | `error` 事件；不落半截 ai message |
| orchestrate 抛错 | `error` 或同步 text 错误回复 |

## Testing / Acceptance

1. **协议**：chat 返回可通过 Zod 的 `AIUIResponse`。
2. **闭环**：提需求 → selection → form → confirmation → analyze stream → steps/card/action_buttons。
3. **持久化**：刷新后 `GET /api/conversations/:id/messages` 可见 content + `metadata.ui`。
4. **流式**：先 progress（及可选 markdown），再整包 ui，最后 done；无半截组件。
5. **并存**：原纯文本 chat 行为不变。
6. **鉴权**：未登录无法访问 ui-chat。
7. **前端 fallback**：未知组件不崩溃。
8. **单测**：ui-schemas；UIOrchestrateAdapter（mock `orchestrate`）。

## Implementation notes

- 代码放置：`services/chat/src/llm/ui-protocol/`（与文档路径一致）；模块挂到 `AppModule`。
- 模型工厂：复用 chat / llm-core 现有 `createChatModel` 模式（实现时对齐本仓实际路径）。
- 不把 UI 协议类型强塞进 `llm-core`（首版留在 chat，避免 Nest/Zod 边界污染）；若两端都要可再抽 `packages/contracts`。
- feat/ai-ui 的 `UIFlowService` 状态机 **不作为主路径**；可选保留极简 fallback 仅用于 Structured Output 全失败时的固定欢迎 `action_buttons`（非必须）。

## Open points resolved in design

| Question | Resolution |
|----------|------------|
| feat/ui vs feat/ai-ui | 使用 autix-demo `feat/ai-ui` |
| 状态机 vs LLM | LLM 主导 |
| session 存储 | Conversation/Message + JWT |
| 分析结果来源 | 现有 `orchestrate` + Adapter |
| 流式范围 | 协议完整；分析路径 SSE；短交互同步 |
| orchestrate 非流式 | progress 可占位；契约按完整流式预留 |
