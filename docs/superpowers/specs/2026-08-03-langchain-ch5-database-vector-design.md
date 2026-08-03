# Design: 第五章——从 Mock 到生产（数据库设计与向量化落库）

**Date:** 2026-08-03  
**Status:** Approved for implementation planning  
**Source:** `docs/AI Agents 开发实践/7-第五章：从 Mock 到生产——数据库设计与向量化落库.md`  
**Branch:** `feat/LangChain-Advanced-Database`

## Goal

把第四章在 `services/api` 中验证过的 Memory / Embedding / Multi-Agent 能力，升级为可多用户、可持久化、可检索的生产形态：

1. 在 `services/chat` 落地 Prisma + PostgreSQL + pgvector、最小 User/JWT、会话与文档 Pipeline、SSE、端到端 RAG + Orchestrator。
2. 抽取 `packages/llm-core`（纯逻辑、无 Nest），供 `chat` 与 `api` 共用。
3. `services/api` 保留 Ch4 Mock 对照（内存历史 / MemoryVectorStore / workspace），实现改为依赖 `llm-core`。

主验收入口（chat）：

`POST /api/conversations/:id/chat` → JWT 用户 → DB 历史 + 用户隔离语义检索 + Multi-Agent → Message 落库

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Auth | 本仓最小 User + JWT（注册/登录/Guard）；不做完整 RBAC |
| Password hash | `bcrypt`（cost 固定实现时选定并写死常量） |
| JWT | `JWT_SECRET` + 合理过期（如 7d）从环境变量读取；payload `sub` = userId |
| Production home | `services/chat`；`services/api` 继续做 Ch3/Ch4 教学 Mock |
| Shared code | `packages/llm-core` 纯 TS（无 Nest / 无 Prisma） |
| Scope | 整章 5.3–5.9 一次设计/实现 |
| Approach | 方案 1：llm-core 纯逻辑 + chat 全量生产壳 |
| Vector store | PostgreSQL + pgvector，`vector(384)`（Xenova MiniLM） |
| File storage | 本地磁盘 `uploads/{userId}/...`；DB 只存元数据 |
| Ports | chat：`PORT ?? 4001`（现有约定）；api：`3001`；文档 curl 端口以本仓为准 |
| Analyze persistence | 主落盘为 Message 表；不再以 `tickets/*.md` 为生产主路径 |
| Frontend | 不做 Web UI（SSE 接口先备好） |
| Out of scope | 完整 RBAC、独立向量库、对象存储、跨实例任务队列、事件回放、改 Ch3 行为 |

## Architecture

```
client (curl / 后续前端)
        │  JWT
        ▼
services/chat (:4001)
├─ AuthModule           register / login / JwtAuthGuard
├─ PrismaModule         PostgreSQL + pgvector
├─ ConversationsModule  CRUD + DatabaseChatMessageHistory
├─ DocumentsModule      upload → parse → chunk → embed → DB
├─ SearchModule         similarity search（按 userId 隔离）
├─ SseModule            processing / done / error
└─ Analyze（挂在 conversations/:id/chat）
        │
        ▼
packages/llm-core       # 无 Nest
├─ createChatModel / config
├─ Embedding（Xenova 384）
├─ parse + RecursiveCharacterTextSplitter helpers
└─ Orchestrator + sub-agents

services/api (:3001)    # Ch4 Mock 意图不变
└─ AdvancedModule 等改为调用 llm-core；仍用 InMemory / MemoryVectorStore / workspace
```

### End-to-end flow (chat)

```
register/login → JWT
  → create Conversation
  → upload Document → POST process (202) → SSE progress
  → POST /api/conversations/:id/chat
       load DB history
       → similaritySearch(input, userId)
       → Orchestrator(history + retrieved + input)
       → persist human + ai Message
```

## Data model

**Location:** `services/chat/prisma/schema.prisma`

| Model | Purpose | Notes |
|-------|---------|-------|
| User | Auth subject | `email` unique, hashed `password`, optional `name`, `role` string default `"user"` |
| Conversation | Session container | `userId`, `title`; `@@index([userId])` |
| Message | Chat turns | `role`: `system\|human\|ai\|tool`; `content` Text; `metadata` Json?; Cascade on Conversation delete |
| Document | Upload metadata | `filename` (path), `originalName`, `mimeType`, `size`, `status`: `pending\|processing\|completed\|failed`, `chunkCount` |
| DocumentChunk | Chunk + vector | `content`, `chunkIndex`, `metadata?`, `embedding Unsupported("vector(384)")?`; Cascade on Document delete |

**Relations:**

```
User 1─* Conversation 1─* Message
User 1─* Document 1─* DocumentChunk(embedding)
```

**Locked details:**

- Embedding optional until async vectorization finishes.
- Isolation: every business query filters by JWT `userId`; cross-user access returns `404`.
- `CREATE EXTENSION IF NOT EXISTS vector` as part of migrate/docs.
- Prisma client only in chat; llm-core never imports Prisma.
- Local Postgres via docker-compose with pgvector image (implementation plan).

## API surface (chat)

All routes except auth require `Authorization: Bearer <jwt>`.

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/api/auth/register` | Create user (hashed password) |
| POST | `/api/auth/login` | Return JWT (`sub` = userId) |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations` | List current user's conversations |
| GET | `/api/conversations/:id/messages` | Message history (ownership check) |
| POST | `/api/conversations/:id/chat` | Production analyze: history + RAG + Orchestrator + persist |
| POST | `/api/documents/upload` | multipart PDF/TXT/MD → `uploads/{userId}/`; Document `pending` |
| GET | `/api/documents` | List documents |
| GET | `/api/documents/:id` | Document detail |
| POST | `/api/documents/:id/process` | `202 Accepted`; background pipeline |
| POST | `/api/search` | `{ query, topK? }` pgvector search scoped to user |
| GET | `/api/sse` | SSE stream: `processing` / `done` / `error` per user |

### Document pipeline

```
upload → Document(pending)
process → 202, status=processing
  → parse PDF/TXT/MD
  → split (RecursiveCharacterTextSplitter)
  → insert DocumentChunk (embedding null)
  → embed via llm-core → write vector(384)
  → status=completed|failed + SSE
```

### `POST .../chat` steps

1. JwtAuthGuard → `userId`; verify Conversation ownership.
2. `DatabaseChatMessageHistory.getMessages()`.
3. `SearchService.similaritySearch(input, userId, topK)`.
4. Build context (history + retrieved chunks + input) → llm-core Orchestrator.
5. Persist human + ai Message rows.
6. Response: `report`, `usedAgents`, `retrievedDocuments` (or clarification payload).

## packages/llm-core

**Package name:** `@autix/llm-core` (align with `@autix/contracts` / `@autix/chat`).

**Includes:**

- Model factory / LangChain config loading (moved from api).
- Embedding service logic (Xenova MiniLM, 384 dims).
- Text parsing helpers + splitter configuration.
- Fixed-workflow Orchestrator + sub-agents + clarification helpers.

**Excludes:** Prisma, JWT, Multer, Nest modules, SSE, HTTP controllers, filesystem upload roots.

**api migration:** Keep HTTP surface and Mock storage; replace duplicated logic with imports from `@autix/llm-core`. Do not change Ch3 `LlmModule` public behavior beyond shared factory extraction if needed.

## Error handling

| Scenario | Behavior |
|----------|----------|
| Missing/invalid JWT | `401` |
| Cross-user Conversation/Document | `404` |
| Unsupported upload type | `400` (PDF/TXT/MD only) |
| `process` while `processing` | `409` |
| `process` while `completed` | `409` by default (no silent re-run; optional force flag out of scope this round) |
| Parse/embed failure | Delete chunks created in this run; Document `failed`; SSE `error` |
| Orchestrator needs clarification | `200` + `need_clarification`; still persist human + ai clarification messages |
| Search empty | Analyze continues with history + input only |
| SSE disconnect | In-memory Subject only; reconnect gets future events; no replay |

## Testing & acceptance

**Unit:** llm-core helpers (splitter options, context assembly); chat ownership checks and document status transitions.

**Integration (curl / script, chapter-aligned):**

1. register → login → JWT.
2. upload policy MD → process → SSE `done` → `/api/search` hits.
3. create conversation → multi-turn `/chat` → restart chat → `GET .../messages` retained.
4. User B cannot read User A's conversations/documents.

**Acceptance checklist:**

- [ ] Five tables + pgvector `vector(384)`
- [ ] JWT-isolated persistent conversation history
- [ ] Upload + parse/chunk/embed pipeline + user-scoped search
- [ ] SSE progress events
- [ ] E2E: login → upload/process → chat (RAG + Multi-Agent) → messages persisted
- [ ] api Ch4 Mock still runnable; core logic from `@autix/llm-core`

## Module & file plan (indicative)

```
packages/llm-core/
  package.json                    # @autix/llm-core
  src/
    index.ts
    model.factory.ts
    embedding.ts
    text/
      parse.ts
      split.ts
    agents/
      orchestrator.ts
      sub-agents.ts
      clarification.ts

services/chat/
  prisma/schema.prisma
  uploads/                        # gitignore runtime files
  src/
    prisma/
    auth/
    conversation/
    document/
    search/
    sse/
    app.module.ts
    main.ts                       # PORT ?? 4001

services/api/
  src/llm/                        # thin Nest wrappers over @autix/llm-core
  workspace/                      # unchanged Mock sandbox
```

## Implementation order (for writing-plans)

1. Scaffold `@autix/llm-core`; migrate api call sites.
2. Prisma schema + migrate + PrismaModule in chat; docker-compose pgvector.
3. Auth (register/login/JWT Guard).
4. Conversations + DatabaseChatMessageHistory.
5. Documents upload + parse/chunk.
6. Embedding write + SearchService.
7. SSE + wire process async 202.
8. Production `/conversations/:id/chat` analyze path.
9. Curl acceptance script / manual checklist against chapter scenarios.

## Non-goals

- Full RBAC / roles beyond a string field.
- Qdrant / Milvus / external vector DB.
- S3 or other object storage.
- Frontend UI / streaming chat tokens (beyond document-task SSE).
- Durable job queue / multi-instance SSE fanout.
- Changing Ch3 demo semantics.
