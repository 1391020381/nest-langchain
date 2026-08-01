# Design: 第三章 LangChain 服务端能力链路

**Date:** 2026-08-01  
**Status:** Approved for implementation planning  
**Source:** `docs/AI Agents 开发实践/5-第三章：LangChain 起手——搭建第一条服务端能力链路.md`  
**Branch:** `feat/LangChain`

## Goal

在现有 Bun monorepo 旁新建 `@autix/api` + `@autix/web`，按第三章递进搭出第一条可维护服务端能力链路，并收束为可测试业务接口：

`POST /requirement/extract` → `{ action, constraints, entities }`

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | 完整递进实现各层能力；演示只留在 Service；对外仅正式业务接口 |
| Layout | 新建 `services/api` + `clients/web`（与现有 chat 并存） |
| Production extract | 模板 + `withStructuredOutput`；不含工具闭环 |
| Scaffold | 克隆 `@autix/chat` / `@autix/chat-web` 骨架再叠 LangChain |
| Ports | API `3001`，Web `3000` |
| Packages | `@autix/api` / `@autix/web` |
| Existing chat | 不改行为；根脚本增量 `dev:api` / `dev:web` |

## Architecture

```
clients/web (@autix/web :3000)
        │ POST /requirement/extract
        ▼
services/api (@autix/api :3001)
        ├─ config/          env + langchain.yaml
        ├─ llm/             factory, prompts, chain, tools, demo Service
        └─ requirement      formal extract Service + Controller entry
        │
packages/contracts          Requirement Zod schemas (shared)
```

**Out of scope for this chapter**

- RAG / real vector DB usage (YAML may reserve `retrieval` fields)
- Memory, multi-agent, MCP
- Demo HTTP routes (`/api/langchain/*`)
- Tools on the formal extract path
- Renaming or migrating existing chat apps

## Module & file plan

### `packages/contracts` (additive)

- `RequirementSchema`
- `RequirementResultSchema`
- `RequirementResult` type

### `services/api`

```
config/langchain.yaml
src/
  main.ts
  app.module.ts
  app.controller.ts              # GET /health + POST /requirement/extract
  config/load-langchain-config.ts
  llm/
    model.factory.ts             # createChatModel() only entry for ChatOpenAI
    llm.module.ts
    llm.service.ts               # all demo methods; no demo Controllers
    prompts/requirement.prompt.ts
    requirement.prompt-builder.ts
    requirement.chain.ts
    tools/basic.tools.ts
    requirement.service.ts       # formal extract()
test/
  llm.demo.spec.ts
  requirement.spec.ts
```

**`LlmService` demo methods (no HTTP):**

- `invokeDemo` / `streamDemo` / `batchDemo`
- `promptPreview` / `promptToModel`
- `chainInvoke` / `chainStream` / `chainBatch`
- `toolBindDemo` / `toolLoopDemo`

**Tools (demo only):**

- `check_constraint_validity`
- `lookup_entity_definition`

### `clients/web`

- Single page: textarea (default sample input), submit, JSON result
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`

### Root scripts

- `dev:api` / `dev:web`
- optional `dev:langchain` (parallel both)
- `clean:ports` includes 3000 / 3001

## Data flow

### Formal path

1. Client sends `{ input: string }`
2. `AppController` → `RequirementService.extract`
3. `ChatPromptTemplate.formatMessages({ input })`
4. `createChatModel().withStructuredOutput(RequirementResultSchema)`
5. Return `{ action, constraints, entities }`

### Config flow

- Secrets / base URL → `process.env` (`.env` gitignored)
- Model params / feature flags → `config/langchain.yaml` via `loadLangChainConfig()`
- Never `new ChatOpenAI` inside business Services; always `createChatModel()`

### Error handling (minimal)

| Case | Behavior |
|------|----------|
| Missing/empty `input` | 400 with clear message |
| Missing `OPENAI_API_KEY` | Fail at startup or first call with clear log |
| LLM / structured parse failure | 500 with readable message (no raw stack to client) |
| CORS | Allow `http://localhost:3000` |
| Demo tool failures | Isolated to demo methods/tests; do not affect formal extract |

### Success contract example

Input: `用户注册时必须绑定手机号，密码至少8位`

```json
{
  "action": "用户注册",
  "constraints": ["必须绑定手机号", "密码至少8位"],
  "entities": ["用户", "手机号", "密码"]
}
```

## Testing & acceptance

### Tests

| File | Covers |
|------|--------|
| `requirement.spec.ts` | Formal `extract` against sample input; assert key fields. Skip with note if no API key |
| `llm.demo.spec.ts` | Smoke at least one path each for invoke / prompt / chain / tool bind or loop via direct Service calls |
| Frontend | Manual: submit default text, see structured JSON |

### Acceptance checklist

1. Branch `feat/LangChain` exists
2. `@autix/api` (:3001) and `@autix/web` (:3000) runnable via dedicated dev scripts
3. Config split: env secrets + YAML runtime params
4. Unified `createChatModel()`
5. Full demo layer in Service only (no demo Controller routes)
6. `POST /requirement/extract` returns stable JSON
7. Contracts export Zod schemas shared by API
8. Existing chat packages unchanged in behavior

## Implementation notes

- Follow Nest/Bun patterns already used by `@autix/chat`
- Prefer document prompts for AI-assisted generation, then align names to this spec
- Chapter teaches progressive APIs; production surface stays thin on purpose
