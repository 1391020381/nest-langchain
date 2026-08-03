# LangChain Ch5 Database / pgvector Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地第五章生产能力：抽取 `@autix/llm-core`，在 `@autix/chat` 实现 Prisma + pgvector + JWT + 会话/文档 Pipeline + SSE + RAG analyze，同时让 `@autix/api` 的 Ch4 Mock 改为依赖 llm-core。

**Architecture:** `packages/llm-core` 持有无 Nest 的模型工厂、Embedding、分块/解析、Orchestrator；`services/chat` 持有 Prisma/JWT/上传/检索/SSE/生产 chat；`services/api` 保留内存 Mock HTTP，核心逻辑改为 re-export / 薄封装 llm-core。

**Tech Stack:** Bun, NestJS 11, Prisma + PostgreSQL + pgvector, `@nestjs/jwt` + `passport-jwt`, bcrypt, Multer, `@langchain/textsplitters`, `pdf-parse`, `@xenova/transformers`, bun:test

**Spec:** `docs/superpowers/specs/2026-08-03-langchain-ch5-database-vector-design.md`

## Scope note

Spec 覆盖 llm-core 抽取 + chat 全量生产链路。按 brainstorming 锁定「整章一次」，本文件用 **一个计划、顺序 Task** 交付；每个 Task 结束都有独立可测点。若执行中压力过大，可在 Task 2（Prisma）或 Task 4（Conversations）后暂停开 PR，不必改设计。

## Global Constraints

- Branch: `feat/LangChain-Advanced-Database`
- Spec: `docs/superpowers/specs/2026-08-03-langchain-ch5-database-vector-design.md`
- Chat port: `PORT ?? 4001`；API port: `3001`
- Auth: bcrypt cost **10**; JWT payload `sub` = userId; env `JWT_SECRET` (required in chat), expiry `7d`
- Embedding dims: **384** (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`)
- Chunking: `chunkSize: 500`, `chunkOverlap: 50`
- Cross-user access → **404**; invalid JWT → **401**
- `process` while `processing` or `completed` → **409**
- Pipeline failure → delete chunks from this run; Document `failed`; SSE `error`
- llm-core: **no** Nest, Prisma, JWT, Multer, SSE
- Do not change Ch3 `LlmModule` public HTTP behavior beyond shared factory extraction
- Tests: `bun test` in package dirs; chat add `"test": "bun test"`
- Frontend: none

---

## File Structure (locked)

| Path | Responsibility |
|------|----------------|
| `packages/llm-core/package.json` | `@autix/llm-core` workspace package |
| `packages/llm-core/tsconfig.json` | Same pattern as contracts |
| `packages/llm-core/src/index.ts` | Public exports |
| `packages/llm-core/src/model.factory.ts` | `createChatModel(options?)` |
| `packages/llm-core/src/embedding.ts` | `LocalEmbeddings` class (no Nest) |
| `packages/llm-core/src/text/parse.ts` | `parseFileContent(buffer, mimeType)` |
| `packages/llm-core/src/text/split.ts` | `splitText(text)` → string[] |
| `packages/llm-core/src/agents/clarification.ts` | Moved from api |
| `packages/llm-core/src/agents/sub-agents.ts` | Agent chains using llm-core model |
| `packages/llm-core/src/agents/orchestrate.ts` | Pure `orchestrate(input)` |
| `packages/llm-core/test/clarification.spec.ts` | Unit tests |
| `packages/llm-core/test/split.spec.ts` | Splitter unit tests |
| `infra/compose/compose.yaml` | Add `postgres` (pgvector) service |
| `services/chat/prisma/schema.prisma` | Five models + pgvector |
| `services/chat/.env.example` | `DATABASE_URL`, `JWT_SECRET`, `PORT`, `HF_ENDPOINT` |
| `services/chat/src/prisma/prisma.service.ts` | PrismaClient + adapter |
| `services/chat/src/prisma/prisma.module.ts` | Global module |
| `services/chat/src/auth/*` | register/login, JwtStrategy, Guard |
| `services/chat/src/conversation/*` | CRUD + `DatabaseChatMessageHistory` + chat analyze |
| `services/chat/src/document/*` | upload + process pipeline |
| `services/chat/src/search/*` | pgvector similarity search |
| `services/chat/src/sse/*` | SSE hub |
| `services/chat/uploads/` | Runtime uploads (gitignored) |
| `services/api/src/llm/model.factory.ts` | Thin wrapper → llm-core + yaml config |
| `services/api/src/llm/agents/*` | Re-export / thin Nest wrapper over llm-core |
| `services/api/src/llm/embedding/embedding.service.ts` | Nest wrapper over `LocalEmbeddings` |

---

### Task 1: Scaffold `@autix/llm-core` and migrate api pure logic

**Files:**
- Create: `packages/llm-core/package.json`
- Create: `packages/llm-core/tsconfig.json`
- Create: `packages/llm-core/src/index.ts`
- Create: `packages/llm-core/src/model.factory.ts`
- Create: `packages/llm-core/src/embedding.ts`
- Create: `packages/llm-core/src/text/parse.ts`
- Create: `packages/llm-core/src/text/split.ts`
- Create: `packages/llm-core/src/agents/clarification.ts`
- Create: `packages/llm-core/src/agents/sub-agents.ts`
- Create: `packages/llm-core/src/agents/orchestrate.ts`
- Create: `packages/llm-core/test/clarification.spec.ts`
- Create: `packages/llm-core/test/split.spec.ts`
- Modify: `services/api/package.json` (add `@autix/llm-core`)
- Modify: `services/api/src/llm/model.factory.ts`
- Modify: `services/api/src/llm/agents/clarification.ts` → re-export
- Modify: `services/api/src/llm/agents/sub-agents.ts` → re-export
- Modify: `services/api/src/llm/agents/orchestrator.service.ts` → call `orchestrate`
- Modify: `services/api/src/llm/embedding/embedding.service.ts` → wrap `LocalEmbeddings`
- Modify: `services/api/test/clarification.spec.ts` (imports still work via re-export)

**Interfaces:**
- Consumes: existing api agents / embedding behavior
- Produces:
  - `createChatModel(options?: ChatModelOptions): ChatOpenAI`
  - `class LocalEmbeddings { init(): Promise<void>; assertReady(): void; embedQuery(text: string): Promise<number[]>; embedDocuments(docs: string[]): Promise<number[][]> }`
  - `parseFileContent(buffer: Buffer, mimeType: string, originalName?: string): Promise<string>`
  - `splitText(text: string): Promise<string[]>`
  - `clarificationFromExtract(parsed: ExtractFields): string[]`
  - `orchestrate(input: string): Promise<OrchestrateResult>`
  - `export type OrchestrateResult` (same shape as current api)

- [ ] **Step 1: Create package scaffold**

`packages/llm-core/package.json`:

```json
{
  "name": "@autix/llm-core",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "bun": "./src/index.ts",
      "import": "./src/index.ts",
      "require": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@langchain/core": "^1.2.4",
    "@langchain/openai": "^1.5.5",
    "@langchain/textsplitters": "^0.1.0",
    "@xenova/transformers": "^2.17.2",
    "pdf-parse": "^1.1.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

If `@langchain/textsplitters` version resolution fails against workspace langchain, pin a version compatible with installed `@langchain/core@^1.2.4` and continue.

`packages/llm-core/tsconfig.json` — copy `packages/contracts/tsconfig.json` verbatim.

- [ ] **Step 2: Write failing clarification + split tests**

`packages/llm-core/test/clarification.spec.ts` — copy assertions from `services/api/test/clarification.spec.ts`, import from `../src/agents/clarification`.

`packages/llm-core/test/split.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { splitText } from "../src/text/split";

describe("splitText", () => {
  test("splits long text into overlapping chunks", async () => {
    const text = "甲".repeat(1200);
    const chunks = await splitText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.length).toBeLessThanOrEqual(500);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd packages/llm-core && bun test
```

Expected: FAIL (modules missing)

- [ ] **Step 4: Implement llm-core sources**

`packages/llm-core/src/model.factory.ts`:

```ts
import { ChatOpenAI } from "@langchain/openai";

export type ChatModelOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  openAIApiKey?: string;
  openAIBaseUrl?: string;
};

export function createChatModel(options: ChatModelOptions = {}) {
  const openAIApiKey =
    options.openAIApiKey ?? process.env.OPENAI_API_KEY ?? "";
  const openAIBaseUrl =
    options.openAIBaseUrl ?? process.env.OPENAI_BASE_URL;
  const model =
    options.model ?? process.env.OPENAI_MODEL ?? "deepseek-ai/DeepSeek-V4-Pro";
  const temperature = options.temperature ?? 0;
  const maxTokens = options.maxTokens ?? 800;

  if (!openAIApiKey) {
    console.warn(
      "[createChatModel] OPENAI_API_KEY is empty; model calls will fail until it is set"
    );
  }

  return new ChatOpenAI({
    model,
    temperature,
    maxTokens,
    openAIApiKey,
    configuration: openAIBaseUrl ? { baseURL: openAIBaseUrl } : undefined,
  });
}
```

`packages/llm-core/src/embedding.ts` — move Xenova logic from api `EmbeddingService` into class `LocalEmbeddings` with `init()`, `assertReady()`, `embedQuery`, `embedDocuments` (no Nest decorators). Use `HF_ENDPOINT` default `https://hf-mirror.com`.

`packages/llm-core/src/text/split.ts`:

```ts
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

export async function splitText(text: string): Promise<string[]> {
  return splitter.splitText(text);
}
```

`packages/llm-core/src/text/parse.ts`:

```ts
import pdf from "pdf-parse";

export async function parseFileContent(
  buffer: Buffer,
  mimeType: string,
  originalName = ""
): Promise<string> {
  const lower = originalName.toLowerCase();
  if (
    mimeType === "application/pdf" ||
    lower.endsWith(".pdf")
  ) {
    const result = await pdf(buffer);
    return result.text;
  }
  if (
    mimeType.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    mimeType === "application/octet-stream"
  ) {
    return buffer.toString("utf8");
  }
  throw new Error(`Unsupported file type: ${mimeType}`);
}
```

`packages/llm-core/src/agents/clarification.ts` — move exact content from `services/api/src/llm/agents/clarification.ts`.

`packages/llm-core/src/agents/sub-agents.ts` — move from api; import `createChatModel` from `../model.factory`.

`packages/llm-core/src/agents/orchestrate.ts` — move logic from `OrchestratorService.orchestrate` into exported async function `orchestrate(input: string): Promise<OrchestrateResult>` (no `@Injectable`). Export `OrchestrateResult` and `ExtractFields` types.

`packages/llm-core/src/index.ts`:

```ts
export { createChatModel, type ChatModelOptions } from "./model.factory";
export { LocalEmbeddings } from "./embedding";
export { parseFileContent } from "./text/parse";
export { splitText } from "./text/split";
export {
  clarificationFromExtract,
  type ExtractFields,
} from "./agents/clarification";
export { orchestrate, type OrchestrateResult } from "./agents/orchestrate";
export {
  extractAgent,
  policyCheckAgent,
  riskReviewAgent,
  qaAgent,
  summaryAgent,
} from "./agents/sub-agents";
```

- [ ] **Step 5: Run llm-core tests**

```bash
cd packages/llm-core && bun install && bun test
```

Expected: PASS for clarification + split

- [ ] **Step 6: Wire api to llm-core**

From repo root:

```bash
cd services/api && bun add @autix/llm-core@workspace:*
```

Replace `services/api/src/llm/model.factory.ts` with yaml-aware wrapper:

```ts
import { createChatModel as createCoreChatModel } from "@autix/llm-core";
import {
  getApiKeys,
  loadLangChainConfig,
} from "../config/load-langchain-config";

export function createChatModel() {
  const config = loadLangChainConfig();
  const keys = getApiKeys();
  return createCoreChatModel({
    model: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
    openAIApiKey: keys.openaiApiKey,
    openAIBaseUrl: keys.openaiBaseUrl,
  });
}
```

`services/api/src/llm/agents/clarification.ts`:

```ts
export {
  clarificationFromExtract,
  type ExtractFields,
} from "@autix/llm-core";
```

`services/api/src/llm/agents/sub-agents.ts`:

```ts
export {
  extractAgent,
  policyCheckAgent,
  riskReviewAgent,
  qaAgent,
  summaryAgent,
} from "@autix/llm-core";
```

**Important:** api sub-agent re-exports use llm-core's `createChatModel()` (env defaults). To keep Ch4 yaml model, either (a) set `OPENAI_MODEL` from yaml at api bootstrap, or (b) change llm-core sub-agents to lazy-init. Prefer (a): in `services/api/src/main.ts` before Nest create, load yaml and set `process.env.OPENAI_MODEL` if unset.

`services/api/src/llm/agents/orchestrator.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { orchestrate, type OrchestrateResult } from "@autix/llm-core";

export type { OrchestrateResult };

@Injectable()
export class OrchestratorService {
  orchestrate(input: string): Promise<OrchestrateResult> {
    return orchestrate(input);
  }
}
```

`EmbeddingService`: hold `private readonly core = new LocalEmbeddings()`; `onModuleInit` → `void this.core.init()...`; delegate `embedQuery` / `embedDocuments` / `assertReady` to `core`.

- [ ] **Step 7: Verify api tests still pass**

```bash
cd services/api && bun test
```

Expected: existing suite PASS (especially `clarification`, `advanced-analysis`, `model.factory`)

- [ ] **Step 8: Commit**

```bash
git add packages/llm-core services/api/package.json services/api/src/llm services/api/src/main.ts bun.lock
git commit -m "feat(llm-core): extract shared model, embedding, and orchestrator"
```

---

### Task 2: Postgres (pgvector) + Prisma schema in chat

**Files:**
- Modify: `infra/compose/compose.yaml`
- Create: `services/chat/prisma/schema.prisma`
- Create: `services/chat/.env.example`
- Create: `services/chat/src/prisma/prisma.service.ts`
- Create: `services/chat/src/prisma/prisma.module.ts`
- Modify: `services/chat/package.json`
- Modify: `services/chat/src/app.module.ts`
- Modify: `.gitignore` (uploads + prisma generate artifacts if needed)

**Interfaces:**
- Consumes: none from Task 1 runtime (chat deps on prisma only here)
- Produces: `PrismaService` global; models User, Conversation, Message, Document, DocumentChunk

- [ ] **Step 1: Add postgres service to compose**

Append to `infra/compose/compose.yaml`:

```yaml
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: nest
      POSTGRES_PASSWORD: nest
      POSTGRES_DB: nest_langchain
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nest -d nest_langchain"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
```

If file currently has no top-level `volumes:`, add it. Keep existing `chat` / `chat-web` services.

- [ ] **Step 2: Install Prisma deps in chat**

```bash
cd services/chat && bun add @prisma/client @prisma/adapter-pg pg bcrypt @nestjs/jwt @nestjs/passport passport passport-jwt @autix/llm-core@workspace:*
cd services/chat && bun add -d prisma @types/bcrypt @types/passport-jwt @types/multer @types/pdf-parse
```

Add scripts to `services/chat/package.json`:

```json
"test": "bun test",
"prisma:generate": "bunx prisma generate",
"prisma:migrate": "bunx prisma migrate dev"
```

- [ ] **Step 3: Write schema**

`services/chat/prisma/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector]
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  name          String?
  password      String
  role          String         @default("user")
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  conversations Conversation[]
  documents     Document[]
}

model Conversation {
  id        String    @id @default(cuid())
  title     String    @default("新会话")
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([userId])
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           String
  content        String       @db.Text
  metadata       Json?
  createdAt      DateTime     @default(now())

  @@index([conversationId])
}

model Document {
  id           String          @id @default(cuid())
  userId       String
  user         User            @relation(fields: [userId], references: [id])
  filename     String
  originalName String
  mimeType     String
  size         Int
  status       String          @default("pending")
  chunkCount   Int             @default(0)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
  chunks       DocumentChunk[]

  @@index([userId])
}

model DocumentChunk {
  id         String                      @id @default(cuid())
  documentId String
  document   Document                    @relation(fields: [documentId], references: [id], onDelete: Cascade)
  content    String                      @db.Text
  chunkIndex Int
  metadata   Json?
  embedding  Unsupported("vector(384)")?
  createdAt  DateTime                    @default(now())

  @@index([documentId])
}
```

`services/chat/.env.example`:

```env
DATABASE_URL=postgresql://nest:nest@localhost:5432/nest_langchain?schema=public
JWT_SECRET=dev-change-me
PORT=4001
HF_ENDPOINT=https://hf-mirror.com
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=deepseek-ai/DeepSeek-V4-Pro
```

Copy to `services/chat/.env` locally (gitignored).

- [ ] **Step 4: Start postgres and migrate**

```bash
docker compose -f infra/compose/compose.yaml up -d postgres
cd services/chat && bunx prisma migrate dev --name init
```

If migrate does not enable extension automatically, create migration SQL first line:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Then `bunx prisma generate`.

- [ ] **Step 5: PrismaModule**

`services/chat/src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

If `@prisma/adapter-pg` API differs for the installed Prisma major, adjust constructor to the version’s documented adapter pattern — do not drop pgvector.

`prisma.module.ts` — `@Global()` module exporting `PrismaService`.

Import `PrismaModule` in `app.module.ts`.

Append to `.gitignore`:

```gitignore
services/chat/uploads/**
!services/chat/uploads/.gitkeep
```

Create `services/chat/uploads/.gitkeep`.

- [ ] **Step 6: Smoke check**

```bash
cd services/chat && bunx prisma studio
```

Or: `bunx prisma db execute --stdin` with `\dt` via `psql`. Expected: five tables; DocumentChunk has embedding column.

- [ ] **Step 7: Commit**

```bash
git add infra/compose/compose.yaml services/chat .gitignore
git commit -m "feat(chat): add Prisma schema and pgvector postgres"
```

---

### Task 3: Auth (register / login / JWT Guard)

**Files:**
- Create: `services/chat/src/auth/auth.module.ts`
- Create: `services/chat/src/auth/auth.service.ts`
- Create: `services/chat/src/auth/auth.controller.ts`
- Create: `services/chat/src/auth/jwt.strategy.ts`
- Create: `services/chat/src/auth/jwt-auth.guard.ts`
- Create: `services/chat/src/auth/current-user.decorator.ts`
- Create: `services/chat/test/auth.service.spec.ts`
- Modify: `services/chat/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`
- Produces:
  - `AuthService.register({ email, password, name? }): Promise<{ id, email }>`
  - `AuthService.login({ email, password }): Promise<{ accessToken }>`
  - `JwtAuthGuard` + `@CurrentUser() user: { userId: string }`
  - Routes: `POST /api/auth/register`, `POST /api/auth/login`

- [ ] **Step 1: Write failing auth unit test**

`services/chat/test/auth.service.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import * as bcrypt from "bcrypt";

describe("password hashing contract", () => {
  test("bcrypt cost 10 roundtrip", async () => {
    const hash = await bcrypt.hash("secret123", 10);
    expect(await bcrypt.compare("secret123", hash)).toBe(true);
    expect(await bcrypt.compare("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd services/chat && bun test test/auth.service.spec.ts
```

Expected: PASS (hashing only). Next steps add service tests with mocked Prisma if desired; minimum is hashing contract + curl later.

- [ ] **Step 3: Implement AuthModule**

Constants: `BCRYPT_COST = 10`.

`AuthService.register`: reject duplicate email with `ConflictException`; hash password; create User.

`AuthService.login`: find by email; `UnauthorizedException` on miss/bad password; sign JWT `{ sub: user.id }` with `JWT_SECRET` and `expiresIn: "7d"`.

`JwtStrategy`: extract Bearer token; validate → `{ userId: payload.sub }`.

`JwtAuthGuard`: standard AuthGuard('jwt').

`CurrentUser` decorator: `(req) => req.user`.

Controller `@Controller('api/auth')`.

Throw at module init if `!process.env.JWT_SECRET`.

- [ ] **Step 4: Manual curl**

```bash
curl -s -X POST http://localhost:4001/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"a@example.com\",\"password\":\"secret123\"}"

curl -s -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"a@example.com\",\"password\":\"secret123\"}"
```

Expected: register returns user; login returns `{ accessToken: "..." }`.

- [ ] **Step 5: Commit**

```bash
git add services/chat/src/auth services/chat/test/auth.service.spec.ts services/chat/src/app.module.ts
git commit -m "feat(chat): add minimal JWT auth register and login"
```

---

### Task 4: Conversations + DatabaseChatMessageHistory

**Files:**
- Create: `services/chat/src/conversation/db-chat-history.ts`
- Create: `services/chat/src/conversation/conversation.service.ts`
- Create: `services/chat/src/conversation/conversation.controller.ts`
- Create: `services/chat/src/conversation/conversation.module.ts`
- Create: `services/chat/test/db-chat-history.spec.ts` (optional with mocked prisma; or integration via curl)
- Modify: `app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`, `JwtAuthGuard`, `@CurrentUser`
- Produces:
  - `class DatabaseChatMessageHistory { constructor(prisma, conversationId); getMessages(); addMessage(role, content, metadata?); }`
  - Routes: `POST/GET /api/conversations`, `GET /api/conversations/:id/messages`
  - Temporary `POST /api/conversations/:id/chat` that **only** echoes + persists human/ai stub (full RAG in Task 8) **OR** leave chat route to Task 8 — **this task implements list/create/messages only; chat route in Task 8**

- [ ] **Step 1: Implement DatabaseChatMessageHistory**

```ts
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { PrismaService } from "../prisma/prisma.service";

export class DatabaseChatMessageHistory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationId: string
  ) {}

  async getMessages(): Promise<BaseMessage[]> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId: this.conversationId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => {
      if (row.role === "human") return new HumanMessage(row.content);
      if (row.role === "ai") return new AIMessage(row.content);
      return new SystemMessage(row.content);
    });
  }

  async addMessage(
    role: "human" | "ai" | "system" | "tool",
    content: string,
    metadata?: Record<string, unknown>
  ) {
    await this.prisma.message.create({
      data: {
        conversationId: this.conversationId,
        role,
        content,
        metadata: metadata ?? undefined,
      },
    });
  }
}
```

- [ ] **Step 2: ConversationService**

- `create(userId, title?)`
- `list(userId)`
- `getOwnedOrThrow(userId, id)` → `NotFoundException` if missing/other user
- `listMessages(userId, id)` after ownership check

- [ ] **Step 3: Controller with JwtAuthGuard**

`@Controller('api/conversations')` + `@UseGuards(JwtAuthGuard)` on class.

- [ ] **Step 4: Curl acceptance**

```bash
TOKEN=... # from login
CONV=$(curl -s -X POST http://localhost:4001/api/conversations \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"title\":\"demo\"}")
# insert a message via prisma studio or temporary service method for smoke;
# ownership: second user GET should 404
```

For message persistence smoke before Task 8, add package-private test helper **or** use Prisma directly in a small `bun` script — do not leave unauthenticated write routes.

Minimal: unit-test `getOwnedOrThrow` logic with mocked prisma returning null → NotFoundException.

- [ ] **Step 5: Commit**

```bash
git add services/chat/src/conversation services/chat/test
git commit -m "feat(chat): persist conversations and message history"
```

---

### Task 5: Document upload + parse/chunk (no vectors yet)

**Files:**
- Create: `services/chat/src/document/document.service.ts`
- Create: `services/chat/src/document/document.controller.ts`
- Create: `services/chat/src/document/document.module.ts`
- Create: `services/chat/test/document-status.spec.ts`
- Modify: `app.module.ts`
- Modify: `services/chat/package.json` if multer types missing

**Interfaces:**
- Consumes: `PrismaService`, `parseFileContent`, `splitText` from `@autix/llm-core`
- Produces:
  - `POST /api/documents/upload`
  - `GET /api/documents`, `GET /api/documents/:id`
  - `DocumentService.processParseAndChunk(userId, documentId)` → creates chunks, sets `chunkCount`, status stays `processing` path reserved for Task 6/7 — **this task:** upload → `pending`; add internal `parseAndChunk` used by process in Task 6

- [ ] **Step 1: Status transition test**

```ts
import { describe, expect, test } from "bun:test";

function assertCanStartProcess(status: string) {
  if (status === "processing" || status === "completed") {
    const err = new Error("conflict");
    (err as any).status = 409;
    throw err;
  }
}

describe("process guard", () => {
  test("pending ok", () => {
    expect(() => assertCanStartProcess("pending")).not.toThrow();
  });
  test("completed conflicts", () => {
    expect(() => assertCanStartProcess("completed")).toThrow();
  });
});
```

Move this helper into `document.service.ts` as `assertProcessable(status: string): void` throwing `ConflictException`.

- [ ] **Step 2: Upload implementation**

- Ensure dir `uploads/{userId}` with `fs.mkdir({ recursive: true })`
- Save file as `{cuid}-{originalName}`
- Allowed: pdf / txt / md (check mimetype **or** extension)
- Create Document row: `status: "pending"`, `filename: relative path`

Use `FileInterceptor('file')` from `@nestjs/platform-express`.

- [ ] **Step 3: List/get with ownership 404**

- [ ] **Step 4: Curl upload**

```bash
curl -s -X POST http://localhost:4001/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@services/api/workspace/policies/return-policy.md"
```

Expected: JSON document with `status: "pending"`.

- [ ] **Step 5: Commit**

```bash
git add services/chat/src/document services/chat/test/document-status.spec.ts
git commit -m "feat(chat): add document upload and ownership APIs"
```

---

### Task 6: Embed chunks + SearchService (pgvector)

**Files:**
- Create: `services/chat/src/search/search.service.ts`
- Create: `services/chat/src/search/search.controller.ts`
- Create: `services/chat/src/search/search.module.ts`
- Create: `services/chat/src/embedding/chat-embedding.service.ts` (Nest wrapper around `LocalEmbeddings`)
- Modify: `document.service.ts` — full `processDocument` (parse → chunk → embed)
- Modify: `document.controller.ts` — `POST :id/process` returns **202**, fires background work (SSE wired in Task 7; for now void promise + status updates)

**Interfaces:**
- Consumes: `LocalEmbeddings`, Prisma `$executeRaw`
- Produces:
  - `SearchService.similaritySearch(query: string, userId: string, topK = 3): Promise<Array<{ content: string; documentId: string; chunkIndex: number; score?: number }>>`
  - `POST /api/search` body `{ query: string, topK?: number }`
  - `POST /api/documents/:id/process` → 202

- [ ] **Step 1: ChatEmbeddingService**

Nest provider that `onModuleInit` calls `local.init()`, exposes `embedQuery` / `embedDocuments`.

- [ ] **Step 2: Write embeddings with raw SQL**

After creating chunk rows, for each chunk:

```ts
const vector = `[${embedding.join(",")}]`;
await this.prisma.$executeRawUnsafe(
  `UPDATE "DocumentChunk" SET embedding = $1::vector WHERE id = $2`,
  vector,
  chunkId
);
```

Prefer tagged `$executeRaw` if Prisma version supports `Prisma.raw` / `Prisma.sql` for vectors; if not, `$executeRawUnsafe` with validated numeric join only (never interpolate user text into SQL).

- [ ] **Step 3: similaritySearch SQL**

```sql
SELECT dc.id, dc.content, dc."documentId", dc."chunkIndex",
       1 - (dc.embedding <=> $1::vector) AS score
FROM "DocumentChunk" dc
INNER JOIN "Document" d ON d.id = dc."documentId"
WHERE d."userId" = $2
  AND dc.embedding IS NOT NULL
  AND d.status = 'completed'
ORDER BY dc.embedding <=> $1::vector
LIMIT $3
```

- [ ] **Step 4: processDocument**

```
assert ownership
assertProcessable(status)
set processing
try:
  read file from filename path
  text = parseFileContent(...)
  chunks = splitText(text)
  delete existing chunks for document (if any)
  create chunk rows
  embedDocuments + update vectors
  status=completed, chunkCount=chunks.length
catch:
  delete chunks for document
  status=failed
  rethrow/log
```

Controller:

```ts
@Post(':id/process')
@HttpCode(202)
async process(@CurrentUser() user, @Param('id') id: string) {
  // validate ownership + assertProcessable synchronously
  void this.documents.processDocument(user.userId, id);
  return { accepted: true, documentId: id };
}
```

- [ ] **Step 5: Curl process + search**

Wait until Document.status is `completed` (poll GET), then:

```bash
curl -s -X POST http://localhost:4001/api/search \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"query\":\"退货期限\",\"topK\":3}"
```

Expected: non-empty content snippets from return-policy.

- [ ] **Step 6: Commit**

```bash
git add services/chat/src/search services/chat/src/embedding services/chat/src/document
git commit -m "feat(chat): vectorize document chunks and add user-scoped search"
```

---

### Task 7: SSE task notifications

**Files:**
- Create: `services/chat/src/sse/sse.service.ts`
- Create: `services/chat/src/sse/sse.controller.ts`
- Create: `services/chat/src/sse/sse.module.ts`
- Modify: `document.service.ts` to emit events
- Modify: `app.module.ts`

**Interfaces:**
- Consumes: RxJS `Subject` / `Observable`
- Produces:
  - `SseService.publish(userId, event: { type: 'processing'|'done'|'error'; documentId: string; message?: string })`
  - `SseService.stream(userId): Observable<MessageEvent>`
  - `GET /api/sse` (JwtAuthGuard)

- [ ] **Step 1: Implement SseService**

Keep `Map<userId, Subject<...>>`. `stream` creates subject if missing. `publish` next’s to that user’s subject. On client disconnect, Nest SSE unsubscribe — remove subject when observer count 0 if easy; else leave until process exit (spec: no replay).

Event payload JSON string in `data`.

- [ ] **Step 2: Wire DocumentService**

- start process → `processing`
- success → `done`
- failure → `error` with message

- [ ] **Step 3: Manual two-terminal test**

Terminal 1:

```bash
curl -N http://localhost:4001/api/sse -H "Authorization: Bearer $TOKEN"
```

Terminal 2: upload + process. Expected: SSE lines with `processing` then `done`.

- [ ] **Step 4: Commit**

```bash
git add services/chat/src/sse services/chat/src/document
git commit -m "feat(chat): push document processing progress over SSE"
```

---

### Task 8: Production `POST /api/conversations/:id/chat` (RAG + Orchestrator)

**Files:**
- Create: `services/chat/src/conversation/analyze.service.ts`
- Modify: `conversation.controller.ts` — add chat route
- Modify: `conversation.module.ts` — import Search + Embedding deps
- Create: `services/chat/test/analyze-context.spec.ts`

**Interfaces:**
- Consumes: `DatabaseChatMessageHistory`, `SearchService.similaritySearch`, `orchestrate` from `@autix/llm-core`
- Produces:
  - `AnalyzeService.analyze(userId, conversationId, input): Promise<{ report?; usedAgents; retrievedDocuments; status?; clarificationQuestions?; ... }>`
  - `POST /api/conversations/:id/chat` body `{ input: string }`

- [ ] **Step 1: Context assembly unit test**

```ts
import { describe, expect, test } from "bun:test";

export function buildAnalyzeInput(args: {
  historyText: string;
  retrieved: string[];
  input: string;
}) {
  const parts = [
    args.historyText ? `历史对话：\n${args.historyText}` : "",
    args.retrieved.length
      ? `相关文档：\n${args.retrieved.join("\n---\n")}`
      : "",
    `用户输入：\n${args.input}`,
  ].filter(Boolean);
  return parts.join("\n\n");
}

describe("buildAnalyzeInput", () => {
  test("includes retrieved docs", () => {
    const s = buildAnalyzeInput({
      historyText: "human: hi",
      retrieved: ["退货7天"],
      input: "我要退货",
    });
    expect(s).toContain("相关文档");
    expect(s).toContain("退货7天");
    expect(s).toContain("我要退货");
  });
});
```

Place `buildAnalyzeInput` in `analyze.service.ts` (exported for test).

- [ ] **Step 2: Implement AnalyzeService**

```ts
async analyze(userId: string, conversationId: string, input: string) {
  await this.conversations.getOwnedOrThrow(userId, conversationId);
  const history = new DatabaseChatMessageHistory(this.prisma, conversationId);
  const messages = await history.getMessages();
  const retrieved = await this.search.similaritySearch(input, userId, 3);
  const historyText = messages
    .map((m) => `${m._getType()}: ${m.content}`)
    .join("\n");
  const enriched = buildAnalyzeInput({
    historyText,
    retrieved: retrieved.map((r) => r.content),
    input,
  });
  const result = await orchestrate(enriched);
  await history.addMessage("human", input);
  const aiContent =
    result.status === "need_clarification"
      ? result.clarificationQuestions.join("\n")
      : (result.report ?? result.error ?? "");
  await history.addMessage("ai", aiContent, {
    usedAgents: result.usedAgents,
    status: result.status,
  });
  return {
    ...result,
    retrievedDocuments: retrieved,
  };
}
```

- [ ] **Step 3: Controller route**

```ts
@Post(':id/chat')
chat(
  @CurrentUser() user: { userId: string },
  @Param('id') id: string,
  @Body() body: { input: string }
) {
  return this.analyze.analyze(user.userId, id, body.input);
}
```

- [ ] **Step 4: E2E curl (needs OPENAI_API_KEY)**

1. login  
2. upload return-policy.md + refund-policy.md  
3. process both; wait SSE/done  
4. create conversation  
5. multi-turn chat including order `EC20240315001` and 退货  
6. restart chat service; `GET .../messages` still has turns  
7. second user cannot access conversation (404)

- [ ] **Step 5: Commit**

```bash
git add services/chat/src/conversation services/chat/test/analyze-context.spec.ts
git commit -m "feat(chat): wire RAG and multi-agent into conversation chat"
```

---

### Task 9: Acceptance script + README notes

**Files:**
- Create: `services/chat/scripts/ch5-smoke.sh` (or `.ps1` + `.sh`)
- Modify: `services/chat/README.md` (create if missing) — how to run postgres, migrate, env, curl
- Optional: root note in existing docs only if needed — **prefer chat README only**

**Interfaces:**
- Produces: repeatable smoke script covering register→login→upload→process→search→chat

- [ ] **Step 1: Write smoke script**

Bash script using `curl` + `jq` if available; document Windows path: run under Git Bash or translate to PowerShell. Script must use `http://localhost:4001` and read `TOKEN` from login response.

- [ ] **Step 2: Run script against local stack**

Expected: exit 0; search returns hits; chat returns report or clarification JSON.

- [ ] **Step 3: Final checklist vs spec**

Mark off acceptance bullets in PR description:

- [ ] Five tables + vector(384)
- [ ] JWT-isolated history
- [ ] Upload pipeline + search
- [ ] SSE
- [ ] E2E chat
- [ ] api still `bun test` green with llm-core

- [ ] **Step 4: Commit**

```bash
git add services/chat/scripts services/chat/README.md
git commit -m "docs(chat): add Ch5 smoke script and runbook"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| `@autix/llm-core` pure package | Task 1 |
| api Mock uses llm-core | Task 1 |
| Prisma five tables + pgvector | Task 2 |
| docker postgres | Task 2 |
| User + JWT bcrypt/JWT_SECRET | Task 3 |
| Conversations + DB history | Task 4 |
| Upload PDF/TXT/MD | Task 5 |
| parse/chunk/embed/search | Task 5–6 |
| process 202 + status machine 409 | Task 5–6 |
| SSE processing/done/error | Task 7 |
| Production chat RAG + orchestrate + Message persist | Task 8 |
| Acceptance / smoke | Task 9 |
| Cross-user 404 | Tasks 3–8 |
| No frontend / no S3 / no full RBAC | Honored (non-goals) |

**Placeholder scan:** none intentional; Prisma adapter constructor may need version tweak — called out in Task 2.

**Type consistency:** `userId` from JWT `sub`; Document statuses `pending|processing|completed|failed`; OrchestrateResult from llm-core reused in AnalyzeService.
