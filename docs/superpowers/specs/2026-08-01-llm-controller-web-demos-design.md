# Design: LlmController HTTP + Web LangChain Demo 页

**Date:** 2026-08-01  
**Status:** Approved for implementation planning  
**Branch:** `feat/LangChain`  
**Related:** `docs/superpowers/specs/2026-08-01-langchain-ch3-capability-chain-design.md`（原设计将 demo 仅留在 Service；本 spec 补回教程中的 HTTP + Web）

## Goal

为已有 `LlmService` demo 方法提供 HTTP 入口（`LlmController`），并在 `@autix/web` 新增 `/langchain` 页面，以与现有 `page.tsx` 相同的交互模式调用这些接口。正式业务入口 `POST /requirement/extract` 保持不变。

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Approach | 薄 Controller 1:1 转调 `LlmService`；单页 demo |
| API prefix | `@Controller('api/langchain')` |
| Structured demo route | **不做** `/api/langchain/structured`；继续用 `/requirement/extract` |
| Web layout | `/` 保留 extract；新增 `/langchain`；互加文字链接 |
| Batch input UX | textarea 按行拆分 → `{ inputs: string[] }` |
| Stream | SSE（`text/event-stream`），与第三章教程一致 |
| DTO / 鉴权 / 美化 UI | 不做 |

## Architecture

```
clients/web (@autix/web :3000)
  /                 → Requirement Extract（现有）
  /langchain        → Demo 选择器 + 调用 /api/langchain/*
        │
        ▼
services/api (@autix/api :3001)
  LlmModule
    controllers: [LlmController]
    providers:   [LlmService, RequirementService]
  LlmController → LlmService（已有方法，基本不改）
  AppController → RequirementService.extract（不变）
```

CORS 已在 `main.ts` 启用（`localhost:3000`），无需改动。

## API routes

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/langchain/invoke` | `{ input: string }` | `{ result: string }` |
| POST | `/api/langchain/stream` | `{ input: string }` | SSE text chunks |
| POST | `/api/langchain/batch` | `{ inputs: string[] }` | `{ results: string[] }` |
| POST | `/api/langchain/prompt-preview` | `{ input: string }` | `{ rendered: string }` |
| POST | `/api/langchain/prompt-to-model` | `{ input: string }` | `{ result: string }` |
| POST | `/api/langchain/chain-invoke` | `{ input: string }` | `{ result: string }` |
| POST | `/api/langchain/chain-stream` | `{ input: string }` | SSE text chunks |
| POST | `/api/langchain/chain-batch` | `{ inputs: string[] }` | `{ results: string[] }` |
| POST | `/api/langchain/tool-bind` | `{ input: string }` | `{ result: string, toolCalls: unknown[] }` |
| POST | `/api/langchain/tool-loop` | `{ input: string }` | `{ result: string }` |

### Controller behavior

- 新建 `services/api/src/llm/llm.controller.ts`
- 每个路由校验：`input` 非空 trim，或 `inputs` 为非空数组且每项非空
- 失败：`400 BadRequestException` / 模型异常 `500`（简短 message）
- `stream` / `chain-stream`：设置 `Content-Type: text/event-stream`，`for await` 写 chunk 后 `res.end()`
- `LlmModule` 增加 `controllers: [LlmController]`

### Service mapping

| Route | `LlmService` method |
|-------|---------------------|
| invoke | `invokeDemo` → wrap `{ result }` |
| stream | `streamDemo` |
| batch | `batchDemo` → wrap `{ results }` |
| prompt-preview | `promptPreview` |
| prompt-to-model | `promptToModel` |
| chain-invoke | `chainInvoke` |
| chain-stream | `chainStream` |
| chain-batch | `chainBatch` |
| tool-bind | `toolBindDemo` |
| tool-loop | `toolLoopDemo` |

`LlmService` 以现有实现为准；仅在返回形状与上表不一致时做 Controller 层轻量包装，不重写业务逻辑。

## Web (`clients/web`)

### Files

- 新建 `app/langchain/page.tsx`（client component）
- 轻量改动：`app/page.tsx` 增加指向 `/langchain` 的链接；`/langchain` 页链回 `/`

### UX

- 默认输入：`用户注册时必须绑定手机号，密码至少8位`（与 extract 页一致）
- `<select>` 切换 demo（对应上表全部 path）
- 非 batch：`POST` body `{ input }`
- `batch` / `chain-batch`：按行 `split` → `filter(Boolean)` → `{ inputs }`
- `stream` / `chain-stream`：`fetch` + `ReadableStream` 逐块追加到结果区
- 其它：`res.json()` 后 `JSON.stringify` 展示在 `<pre>`
- loading / error 处理对齐 `page.tsx`

### Env

- 继续使用 `NEXT_PUBLIC_API_BASE_URL`（如 `http://localhost:3001`）

## Error handling

| Case | Behavior |
|------|----------|
| 空 `input` / 空 `inputs` | HTTP 400 |
| Service / LLM 异常 | HTTP 500，简短 message |
| 前端 `!res.ok` | 展示错误文本；流式失败则设置 error |

## Testing

- 保留 `services/api/test/llm.demo.spec.ts`（Service 级）
- 可选新增 Controller 轻量测试：空 body → 400；`prompt-preview` 返回含输入（不依赖 API key）
- 需真实模型的用例继续 `test.skipIf(!OPENAI_API_KEY)`

## Out of scope

- `/api/langchain/structured`
- 鉴权、限流、独立 DTO 校验库、UI 设计系统改造
- 修改 `RequirementService` / extract 契约
- 改动现有 chat 应用

## Success criteria

1. 上述 10 个 demo 路由可经 curl / Web 调用
2. `/langchain` 可切换能力并展示结果（含流式累积）
3. `/requirement/extract` 与首页行为不变
4. 空输入返回 400

