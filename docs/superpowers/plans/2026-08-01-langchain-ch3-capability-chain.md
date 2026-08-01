# LangChain Ch3 Capability Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 monorepo 中新建 `@autix/api` + `@autix/web`，落地第三章能力链路，对外仅暴露 `POST /requirement/extract`，演示层只留在 Service / 单测。

**Architecture:** 从 `@autix/chat` / `@autix/chat-web` 克隆骨架；API 侧用 YAML+env 配置、`createChatModel()` 工厂、`LlmService` 承载演示方法、`RequirementService` 做正式结构化抽取；Web 只负责输入与展示。现有 chat 包不改行为。

**Tech Stack:** Bun workspaces, NestJS 11, Next.js 16, LangChain (`langchain` / `@langchain/openai` / `@langchain/core`), Zod, js-yaml, `@autix/contracts`

**Spec:** `docs/superpowers/specs/2026-08-01-langchain-ch3-capability-chain-design.md`

## Global Constraints

- Branch: `feat/LangChain` (already exists; do not create from other branches mid-work)
- Packages: `@autix/api` (port `3001`), `@autix/web` (port `3000`)
- Contracts package name stays `@autix/contracts` (not `@repo/contracts`)
- Formal extract = prompt template + `withStructuredOutput` only (no tools on that path)
- Demo capabilities live in `LlmService` methods only — **no** `/api/langchain/*` Controllers
- Never `new ChatOpenAI` outside `createChatModel()`
- Secrets in `process.env`; runtime params in `services/api/config/langchain.yaml`
- Do not change behavior of `@autix/chat` / `@autix/chat-web`
- Tests run with `bun test` under `services/api`
- Sample input everywhere: `用户注册时必须绑定手机号，密码至少8位`

---

## File Structure (locked)

| Path | Responsibility |
|------|----------------|
| `packages/contracts/src/index.ts` | Add Requirement Zod schemas + types; keep `APP_NAME` |
| `services/api/package.json` | Nest API package `@autix/api` |
| `services/api/config/langchain.yaml` | LLM / retrieval / tools / features runtime config |
| `services/api/.env.example` | Documented env keys (no real secrets) |
| `services/api/src/config/load-langchain-config.ts` | Load YAML + `getApiKeys()` |
| `services/api/src/llm/model.factory.ts` | `createChatModel()` |
| `services/api/src/llm/prompts/requirement.prompt.ts` | System + user template constants |
| `services/api/src/llm/requirement.prompt-builder.ts` | `ChatPromptTemplate` export |
| `services/api/src/llm/requirement.chain.ts` | `prompt.pipe(model).pipe(StringOutputParser)` |
| `services/api/src/llm/tools/basic.tools.ts` | Two demo tools |
| `services/api/src/llm/llm.service.ts` | All demo methods |
| `services/api/src/llm/requirement.service.ts` | Formal `extract(input)` |
| `services/api/src/llm/llm.module.ts` | Providers: LlmService, RequirementService |
| `services/api/src/app.controller.ts` | `GET /health`, `POST /requirement/extract` |
| `services/api/src/app.module.ts` | Import LlmModule |
| `services/api/src/main.ts` | Listen 3001, CORS for :3000 |
| `services/api/test/load-config.spec.ts` | Config loader unit tests |
| `services/api/test/basic.tools.spec.ts` | Tool unit tests (no LLM) |
| `services/api/test/llm.demo.spec.ts` | Demo smoke (skip without API key) |
| `services/api/test/requirement.spec.ts` | Formal extract (skip without API key) |
| `clients/web/*` | Next app for extract UI |
| `package.json` (root) | `dev:api`, `dev:web`, `dev:langchain`, ports 3000/3001 |

---

### Task 1: Scaffold `@autix/api` + root scripts + health

**Files:**
- Create: `services/api/package.json`
- Create: `services/api/nest-cli.json`
- Create: `services/api/tsconfig.json`
- Create: `services/api/tsconfig.build.json`
- Create: `services/api/src/main.ts`
- Create: `services/api/src/app.module.ts`
- Create: `services/api/src/app.controller.ts`
- Create: `services/api/src/app.service.ts`
- Create: `services/api/test/health.spec.ts`
- Modify: `package.json` (root scripts)

**Interfaces:**
- Consumes: Nest patterns from `services/chat`
- Produces: `@autix/api` package with `GET /health` → `{ ok: true }` on port 3001

- [ ] **Step 1: Write the failing health test**

Create `services/api/test/health.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { AppService } from "../src/app.service";

describe("AppService health", () => {
  test("returns ok true", () => {
    const service = new AppService();
    expect(service.getHealth()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test services/api/test/health.spec.ts`
Expected: FAIL (module / package not found)

- [ ] **Step 3: Scaffold API package from chat skeleton**

Create `services/api/package.json`:

```json
{
  "name": "@autix/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "bun --watch src/main.ts",
    "build": "rm -rf dist tsconfig.tsbuildinfo && nest build",
    "start": "bun run dist/main.js",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@autix/contracts": "workspace:*",
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

Copy `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json` from `services/chat` unchanged (same content).

Create `services/api/src/app.service.ts`:

```ts
import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHealth(): { ok: boolean } {
    return { ok: true };
  }
}
```

Create `services/api/src/app.controller.ts`:

```ts
import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("health")
  getHealth() {
    return this.appService.getHealth();
  }
}
```

Create `services/api/src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

Create `services/api/src/main.ts`:

```ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API service running on http://localhost:${port}`);
}

bootstrap();
```

Update root `package.json` scripts (merge with existing; keep chat scripts):

```json
{
  "scripts": {
    "clean:ports": "for port in 3000 3001 3002 4001; do lsof -ti :$port | xargs kill -9 2>/dev/null; done; echo 'Ports cleaned'",
    "dev": "bun run clean:ports && turbo run dev --parallel --filter=@autix/chat --filter=@autix/chat-web",
    "dev:chat-web": "turbo run dev --filter=@autix/chat-web",
    "dev:chat": "turbo run dev --filter=@autix/chat",
    "dev:api": "turbo run dev --filter=@autix/api",
    "dev:web": "turbo run dev --filter=@autix/web",
    "dev:langchain": "bun run clean:ports && turbo run dev --parallel --filter=@autix/api --filter=@autix/web",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint"
  }
}
```

Run: `bun install` from repo root.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test services/api/test/health.spec.ts`
Expected: PASS

- [ ] **Step 5: Smoke start API**

Run: `bun run --cwd services/api dev` (or `bun run dev:api`), then:
`curl -s http://localhost:3001/health`
Expected: `{"ok":true}`

Stop the process after smoke check.

- [ ] **Step 6: Commit**

```bash
git add services/api package.json bun.lock
git commit -m "$(cat <<'EOF'
feat(api): scaffold Nest @autix/api with health endpoint

Clone chat service patterns onto port 3001 and wire root dev:api scripts.
EOF
)"
```

---

### Task 2: Shared Requirement contracts

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/requirement.spec.ts` (or test under contracts via bun)

**Interfaces:**
- Consumes: existing `zod` in `@autix/contracts`
- Produces:
  - `RequirementSchema = z.object({ input: z.string().min(1) })`
  - `RequirementResultSchema = z.object({ action: z.string(), constraints: z.array(z.string()), entities: z.array(z.string()) })`
  - `type RequirementResult = z.infer<typeof RequirementResultSchema>`

- [ ] **Step 1: Write the failing schema test**

Create `packages/contracts/src/requirement.schema.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { RequirementResultSchema, RequirementSchema } from "./index";

describe("Requirement schemas", () => {
  test("rejects empty input", () => {
    const parsed = RequirementSchema.safeParse({ input: "" });
    expect(parsed.success).toBe(false);
  });

  test("accepts valid result shape", () => {
    const parsed = RequirementResultSchema.safeParse({
      action: "用户注册",
      constraints: ["必须绑定手机号"],
      entities: ["用户", "手机号"],
    });
    expect(parsed.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/contracts/src/requirement.schema.spec.ts`
Expected: FAIL (exports missing)

- [ ] **Step 3: Implement schemas**

Replace/extend `packages/contracts/src/index.ts` to:

```ts
import { z } from "zod";

export const APP_NAME = "llm";

export const RequirementSchema = z.object({
  input: z.string().min(1),
});

export const RequirementResultSchema = z.object({
  action: z.string().describe("唯一核心动作"),
  constraints: z.array(z.string()).describe("明确约束条件"),
  entities: z.array(z.string()).describe("关键实体"),
});

export type RequirementResult = z.infer<typeof RequirementResultSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/contracts/src/requirement.schema.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/index.ts packages/contracts/src/requirement.schema.spec.ts
git commit -m "$(cat <<'EOF'
feat(contracts): add Requirement Zod schemas for extract API

Share input/result shapes between API and future clients.
EOF
)"
```

---

### Task 3: Config loader (YAML + env)

**Files:**
- Create: `services/api/config/langchain.yaml`
- Create: `services/api/.env.example`
- Create: `services/api/src/config/load-langchain-config.ts`
- Create: `services/api/test/load-config.spec.ts`
- Modify: `services/api/package.json` (add `js-yaml`, `@types/js-yaml`)

**Interfaces:**
- Consumes: `config/langchain.yaml` on disk relative to `process.cwd()` when running from `services/api`
- Produces:
  - `loadLangChainConfig(): LangChainAppConfig`
  - `getApiKeys(): { openaiApiKey, openaiBaseUrl, embeddingApiKey, vectorDbUrl, vectorDbApiKey }`

- [ ] **Step 1: Write the failing config test**

Create `services/api/test/load-config.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { getApiKeys, loadLangChainConfig } from "../src/config/load-langchain-config";

describe("loadLangChainConfig", () => {
  test("loads llm model from yaml", () => {
    const config = loadLangChainConfig();
    expect(config.llm.model.length).toBeGreaterThan(0);
    expect(typeof config.llm.temperature).toBe("number");
    expect(config.features.enableStructuredOutput).toBe(true);
  });
});

describe("getApiKeys", () => {
  test("reads OPENAI_API_KEY from env", () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test";
    const keys = getApiKeys();
    expect(keys.openaiApiKey).toBe("sk-test");
    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && bun test test/load-config.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Install js-yaml and implement loader**

Run: `bun add js-yaml --cwd services/api && bun add -d @types/js-yaml --cwd services/api`

Create `services/api/config/langchain.yaml`:

```yaml
llm:
  provider: openai
  model: gpt-4o-mini
  temperature: 0
  maxTokens: 800

retrieval:
  enabled: false
  topK: 3

tools:
  enableConstraintCheck: true
  enableEntityLookup: true

features:
  enableStructuredOutput: true
  enableStreaming: true
```

Create `services/api/.env.example`:

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=
EMBEDDING_API_KEY=
VECTOR_DB_URL=
VECTOR_DB_API_KEY=
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

Create `services/api/src/config/load-langchain-config.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export type LangChainAppConfig = {
  llm: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  retrieval: {
    enabled: boolean;
    topK: number;
  };
  tools: {
    enableConstraintCheck: boolean;
    enableEntityLookup: boolean;
  };
  features: {
    enableStructuredOutput: boolean;
    enableStreaming: boolean;
  };
};

export function loadLangChainConfig(): LangChainAppConfig {
  const filePath = path.join(process.cwd(), "config", "langchain.yaml");
  const raw = fs.readFileSync(filePath, "utf8");
  return yaml.load(raw) as LangChainAppConfig;
}

export function getApiKeys() {
  return {
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    embeddingApiKey:
      process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
    vectorDbUrl: process.env.VECTOR_DB_URL,
    vectorDbApiKey: process.env.VECTOR_DB_API_KEY,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/api && bun test test/load-config.spec.ts`
Expected: PASS (cwd must be `services/api` so YAML path resolves)

- [ ] **Step 5: Commit**

```bash
git add services/api/config/langchain.yaml services/api/.env.example \
  services/api/src/config/load-langchain-config.ts \
  services/api/test/load-config.spec.ts services/api/package.json bun.lock
git commit -m "$(cat <<'EOF'
feat(api): add LangChain YAML config loader and env key helpers

Split secrets into env and runtime knobs into langchain.yaml.
EOF
)"
```

---

### Task 4: Model factory + LlmModule skeleton

**Files:**
- Create: `services/api/src/llm/model.factory.ts`
- Create: `services/api/src/llm/llm.service.ts` (minimal)
- Create: `services/api/src/llm/llm.module.ts`
- Create: `services/api/test/model.factory.spec.ts`
- Modify: `services/api/src/app.module.ts`
- Modify: `services/api/package.json` (add langchain deps)

**Interfaces:**
- Consumes: `loadLangChainConfig`, `getApiKeys`
- Produces: `createChatModel(): ChatOpenAI`

- [ ] **Step 1: Write the failing factory test**

Create `services/api/test/model.factory.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { createChatModel } from "../src/llm/model.factory";

describe("createChatModel", () => {
  test("returns a chat model instance with invoke", () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-placeholder";
    const model = createChatModel();
    expect(typeof model.invoke).toBe("function");
    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && bun test test/model.factory.spec.ts`
Expected: FAIL

- [ ] **Step 3: Install LangChain deps and implement factory + module**

Run:

```bash
bun add langchain @langchain/openai @langchain/core --cwd services/api
```

Create `services/api/src/llm/model.factory.ts`:

```ts
import { ChatOpenAI } from "@langchain/openai";
import {
  getApiKeys,
  loadLangChainConfig,
} from "../config/load-langchain-config";

export function createChatModel() {
  const config = loadLangChainConfig();
  const keys = getApiKeys();

  if (!keys.openaiApiKey) {
    console.warn(
      "[createChatModel] OPENAI_API_KEY is empty; model calls will fail until it is set"
    );
  }

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

Create `services/api/src/llm/llm.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { createChatModel } from "./model.factory";

@Injectable()
export class LlmService {
  private model = createChatModel();
}
```

Create `services/api/src/llm/llm.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { LlmService } from "./llm.service";

@Module({
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
```

Update `services/api/src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { LlmModule } from "./llm/llm.module";

@Module({
  imports: [LlmModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/api && bun test test/model.factory.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/llm services/api/src/app.module.ts \
  services/api/test/model.factory.spec.ts services/api/package.json bun.lock
git commit -m "$(cat <<'EOF'
feat(api): add ChatOpenAI factory and LlmModule skeleton

Centralize model construction so services never new ChatOpenAI directly.
EOF
)"
```

---

### Task 5: Demo tools (pure unit) + LlmService model demos

**Files:**
- Create: `services/api/src/llm/tools/basic.tools.ts`
- Create: `services/api/test/basic.tools.spec.ts`
- Modify: `services/api/src/llm/llm.service.ts`
- Create: `services/api/test/llm.demo.spec.ts` (partial — model demos)

**Interfaces:**
- Consumes: `createChatModel`, `@langchain/core/tools`, `@langchain/core/messages`
- Produces on `LlmService`:
  - `invokeDemo(input: string): Promise<string>`
  - `streamDemo(input: string): Promise<AsyncIterable<{ content: unknown }>>` (or LangChain stream type)
  - `batchDemo(inputs: string[]): Promise<string[]>`
  - Tools: `checkConstraintValidityTool`, `lookupEntityDefinitionTool`

- [ ] **Step 1: Write failing tool unit tests**

Create `services/api/test/basic.tools.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  checkConstraintValidityTool,
  lookupEntityDefinitionTool,
} from "../src/llm/tools/basic.tools";

describe("basic tools", () => {
  test("check_constraint_validity passes explicit constraints", async () => {
    const result = await checkConstraintValidityTool.invoke({
      constraint: "必须绑定手机号",
    });
    expect(result.passed).toBe(true);
  });

  test("lookup_entity_definition returns known entity", async () => {
    const result = await lookupEntityDefinitionTool.invoke({ entity: "密码" });
    expect(result.definition).toContain("登录");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && bun test test/basic.tools.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement tools**

Create `services/api/src/llm/tools/basic.tools.ts`:

```ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const checkConstraintValidityTool = tool(
  async ({ constraint }: { constraint: string }) => {
    const passed = /必须|至少|不得|不能/.test(constraint);
    return {
      constraint,
      passed,
      reason: passed ? "命中明确约束模式" : "不属于明确约束表达",
    };
  },
  {
    name: "check_constraint_validity",
    description: "校验一条约束是否属于明确约束表达",
    schema: z.object({
      constraint: z.string(),
    }),
  }
);

export const lookupEntityDefinitionTool = tool(
  async ({ entity }: { entity: string }) => {
    const map: Record<string, string> = {
      用户: "系统中的账号主体",
      手机号: "用于身份绑定与验证的联系字段",
      密码: "用于登录认证的安全凭证",
    };

    return {
      entity,
      definition: map[entity] ?? "未命中内置定义",
    };
  },
  {
    name: "lookup_entity_definition",
    description: "查询实体在业务中的定义说明",
    schema: z.object({
      entity: z.string(),
    }),
  }
);
```

- [ ] **Step 4: Run tool tests — expect PASS**

Run: `cd services/api && bun test test/basic.tools.spec.ts`
Expected: PASS

- [ ] **Step 5: Add model demo methods + LLM smoke test**

Extend `services/api/src/llm/llm.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { createChatModel } from "./model.factory";

const SYSTEM = "你是一名需求结构化抽取助手";

@Injectable()
export class LlmService {
  private model = createChatModel();

  async invokeDemo(input: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM),
      new HumanMessage(
        `请从下面文本中抽取 action、constraints、entities：\n${input}`
      ),
    ];
    const response = await this.model.invoke(messages);
    return response.content.toString();
  }

  async streamDemo(input: string) {
    return this.model.stream([
      new SystemMessage(SYSTEM),
      new HumanMessage(`请逐步分析并输出结构化抽取结果：\n${input}`),
    ]);
  }

  async batchDemo(inputs: string[]): Promise<string[]> {
    const messageGroups = inputs.map((input) => [
      new SystemMessage(SYSTEM),
      new HumanMessage(`请抽取 action、constraints、entities：\n${input}`),
    ]);
    const responses = await this.model.batch(messageGroups);
    return responses.map((item) => item.content.toString());
  }
}
```

Create `services/api/test/llm.demo.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { LlmService } from "../src/llm/llm.service";

const SAMPLE = "用户注册时必须绑定手机号，密码至少8位";
const hasKey = Boolean(process.env.OPENAI_API_KEY);

describe("LlmService demos", () => {
  test.skipIf(!hasKey)("invokeDemo returns non-empty text", async () => {
    const service = new LlmService();
    const result = await service.invokeDemo(SAMPLE);
    expect(result.length).toBeGreaterThan(0);
  });
});
```

Run: `cd services/api && bun test test/llm.demo.spec.ts`
Expected: PASS (or skipped if no key — both OK)

- [ ] **Step 6: Commit**

```bash
git add services/api/src/llm/tools/basic.tools.ts \
  services/api/src/llm/llm.service.ts \
  services/api/test/basic.tools.spec.ts \
  services/api/test/llm.demo.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): add demo tools and basic model invoke/stream/batch methods

Keep tools and model demos in Service layer without HTTP exposure.
EOF
)"
```

---

### Task 6: Prompt templates + chain demos

**Files:**
- Create: `services/api/src/llm/prompts/requirement.prompt.ts`
- Create: `services/api/src/llm/requirement.prompt-builder.ts`
- Create: `services/api/src/llm/requirement.chain.ts`
- Modify: `services/api/src/llm/llm.service.ts`
- Modify: `services/api/test/llm.demo.spec.ts`
- Create: `services/api/test/requirement.prompt.spec.ts`

**Interfaces:**
- Consumes: prompt constants, `createChatModel`
- Produces:
  - `requirementPrompt` (`ChatPromptTemplate`)
  - `requirementChain`
  - `LlmService.promptPreview(input)`, `promptToModel(input)`, `chainInvoke`, `chainStream`, `chainBatch`

- [ ] **Step 1: Write failing prompt render test**

Create `services/api/test/requirement.prompt.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { requirementPrompt } from "../src/llm/requirement.prompt-builder";

describe("requirementPrompt", () => {
  test("renders input into human message", async () => {
    const value = await requirementPrompt.invoke({
      input: "用户注册时必须绑定手机号，密码至少8位",
    });
    const text = value.toString();
    expect(text).toContain("用户注册时必须绑定手机号");
    expect(text).toContain("需求结构化抽取助手");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && bun test test/requirement.prompt.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement prompt + builder + chain + service methods**

Create `services/api/src/llm/prompts/requirement.prompt.ts`:

```ts
export const REQUIREMENT_SYSTEM_PROMPT = `
你是一名“需求结构化抽取助手”。

你的任务是：
从输入文本中提取结构化字段。

严格要求：
1. 不允许编造信息
2. action 必须是唯一核心动作（动词+对象）
3. constraints 只保留明确约束（必须 / 至少 / 不得 / 不能）
4. entities 只提取文本中真实出现的名词
5. 如果不存在某字段，返回空数组

输出必须符合 schema，不要输出解释
`.trim();

export const REQUIREMENT_USER_TEMPLATE = `
请抽取结构化信息：

输入：
{input}
`.trim();
```

Create `services/api/src/llm/requirement.prompt-builder.ts`:

```ts
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  REQUIREMENT_SYSTEM_PROMPT,
  REQUIREMENT_USER_TEMPLATE,
} from "./prompts/requirement.prompt";

export const requirementPrompt = ChatPromptTemplate.fromMessages([
  ["system", REQUIREMENT_SYSTEM_PROMPT],
  ["human", REQUIREMENT_USER_TEMPLATE],
]);
```

Create `services/api/src/llm/requirement.chain.ts`:

```ts
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createChatModel } from "./model.factory";
import { requirementPrompt } from "./requirement.prompt-builder";

const model = createChatModel();
const parser = new StringOutputParser();

export const requirementChain = requirementPrompt.pipe(model).pipe(parser);
```

Add to `LlmService` (keep existing methods; append):

```ts
import { requirementPrompt } from "./requirement.prompt-builder";
import { requirementChain } from "./requirement.chain";

async promptPreview(input: string) {
  const promptValue = await requirementPrompt.invoke({ input });
  return { rendered: promptValue.toString() };
}

async promptToModel(input: string) {
  const messages = await requirementPrompt.formatMessages({ input });
  const response = await this.model.invoke(messages);
  return { result: response.content.toString() };
}

async chainInvoke(input: string) {
  const result = await requirementChain.invoke({ input });
  return { result };
}

async chainStream(input: string) {
  return requirementChain.stream({ input });
}

async chainBatch(inputs: string[]) {
  const results = await requirementChain.batch(inputs.map((input) => ({ input })));
  return { results };
}
```

Extend `llm.demo.spec.ts`:

```ts
test("promptPreview renders without calling the model", async () => {
  const service = new LlmService();
  const { rendered } = await service.promptPreview(SAMPLE);
  expect(rendered).toContain(SAMPLE);
});

test.skipIf(!hasKey)("chainInvoke returns non-empty text", async () => {
  const service = new LlmService();
  const { result } = await service.chainInvoke(SAMPLE);
  expect(result.length).toBeGreaterThan(0);
});
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd services/api && bun test test/requirement.prompt.spec.ts test/llm.demo.spec.ts
```

Expected: prompt tests PASS; LLM tests PASS or skip

- [ ] **Step 5: Commit**

```bash
git add services/api/src/llm/prompts \
  services/api/src/llm/requirement.prompt-builder.ts \
  services/api/src/llm/requirement.chain.ts \
  services/api/src/llm/llm.service.ts \
  services/api/test/requirement.prompt.spec.ts \
  services/api/test/llm.demo.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): add requirement prompts, chain, and Service demos

Template and pipe demos stay callable from tests without HTTP routes.
EOF
)"
```

---

### Task 7: Tool bind / loop demos on LlmService

**Files:**
- Modify: `services/api/src/llm/llm.service.ts`
- Modify: `services/api/test/llm.demo.spec.ts`

**Interfaces:**
- Consumes: `checkConstraintValidityTool`, `lookupEntityDefinitionTool`
- Produces:
  - `toolBindDemo(input: string): Promise<{ result: string; toolCalls: unknown[] }>`
  - `toolLoopDemo(input: string): Promise<{ result: string }>`

- [ ] **Step 1: Write failing test stubs for method presence**

Append to `services/api/test/llm.demo.spec.ts`:

```ts
test("tool demo methods are defined", () => {
  const service = new LlmService();
  expect(typeof service.toolBindDemo).toBe("function");
  expect(typeof service.toolLoopDemo).toBe("function");
});

test.skipIf(!hasKey)("toolBindDemo returns toolCalls array field", async () => {
  const service = new LlmService();
  const result = await service.toolBindDemo(SAMPLE);
  expect(Array.isArray(result.toolCalls)).toBe(true);
  expect(typeof result.result).toBe("string");
});
```

- [ ] **Step 2: Run test to verify presence check fails**

Run: `cd services/api && bun test test/llm.demo.spec.ts`
Expected: FAIL on missing methods

- [ ] **Step 3: Implement toolBindDemo + toolLoopDemo**

Append to `LlmService`:

```ts
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import {
  checkConstraintValidityTool,
  lookupEntityDefinitionTool,
} from "./tools/basic.tools";

async toolBindDemo(input: string) {
  const modelWithTools = this.model.bindTools([
    checkConstraintValidityTool,
    lookupEntityDefinitionTool,
  ]);

  const response = await modelWithTools.invoke([
    new SystemMessage("你可以按需要调用工具来校验约束和查询实体定义。"),
    new HumanMessage(`请分析下面需求：${input}`),
  ]);

  return {
    result: response.content?.toString?.() ?? String(response.content ?? ""),
    toolCalls: response.tool_calls ?? [],
  };
}

async toolLoopDemo(input: string) {
  const tools = [checkConstraintValidityTool, lookupEntityDefinitionTool];
  const toolMap = Object.fromEntries(tools.map((t) => [t.name, t]));
  const modelWithTools = this.model.bindTools(tools);

  const messages: BaseMessage[] = [
    new SystemMessage("你可以调用工具来帮助完成需求抽取后的校验。"),
    new HumanMessage(
      `先抽取 action、constraints、entities，再按需要调用工具：${input}`
    ),
  ];

  const firstResponse = await modelWithTools.invoke(messages);
  messages.push(firstResponse);

  for (const toolCall of firstResponse.tool_calls ?? []) {
    const targetTool = toolMap[toolCall.name];
    if (!targetTool) continue;
    const toolResult = await targetTool.invoke(toolCall.args);
    messages.push(
      new ToolMessage({
        tool_call_id: toolCall.id!,
        content: JSON.stringify(toolResult),
      })
    );
  }

  const finalResponse = await modelWithTools.invoke(messages);
  return { result: finalResponse.content?.toString?.() ?? String(finalResponse.content ?? "") };
}
```

- [ ] **Step 4: Run tests**

Run: `cd services/api && bun test test/llm.demo.spec.ts`
Expected: presence PASS; LLM cases PASS or skip

- [ ] **Step 5: Commit**

```bash
git add services/api/src/llm/llm.service.ts services/api/test/llm.demo.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): add tool bind and tool loop demo methods

Model decides tool calls; Service executes the closed loop for learning demos.
EOF
)"
```

---

### Task 8: Formal `RequirementService` + `POST /requirement/extract`

**Files:**
- Create: `services/api/src/llm/requirement.service.ts`
- Modify: `services/api/src/llm/llm.module.ts`
- Modify: `services/api/src/app.controller.ts`
- Modify: `services/api/src/app.module.ts` (if needed — preferably export RequirementService from LlmModule)
- Create: `services/api/test/requirement.spec.ts`

**Interfaces:**
- Consumes: `RequirementResultSchema`, `requirement` prompts, `createChatModel`
- Produces:
  - `RequirementService.extract(input: string): Promise<RequirementResult>`
  - `POST /requirement/extract` body `{ input: string }` → `RequirementResult`
  - Empty input → HTTP 400 via `BadRequestException`

- [ ] **Step 1: Write failing extract tests**

Create `services/api/test/requirement.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { BadRequestException } from "@nestjs/common";
import { RequirementService } from "../src/llm/requirement.service";

const SAMPLE = "用户注册时必须绑定手机号，密码至少8位";
const hasKey = Boolean(process.env.OPENAI_API_KEY);

describe("RequirementService", () => {
  test("rejects empty input", async () => {
    const service = new RequirementService();
    expect(service.extract("")).rejects.toBeInstanceOf(BadRequestException);
  });

  test.skipIf(!hasKey)("extracts structured fields from sample", async () => {
    const service = new RequirementService();
    const result = await service.extract(SAMPLE);
    expect(result.action).toContain("注册");
    expect(result.constraints.some((c) => c.includes("手机号"))).toBe(true);
    expect(result.entities).toContain("手机号");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && bun test test/requirement.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement RequirementService + Controller**

Create `services/api/src/llm/requirement.service.ts`:

```ts
import { BadRequestException, Injectable } from "@nestjs/common";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RequirementResultSchema,
  type RequirementResult,
} from "@autix/contracts";
import { createChatModel } from "./model.factory";
import {
  REQUIREMENT_SYSTEM_PROMPT,
  REQUIREMENT_USER_TEMPLATE,
} from "./prompts/requirement.prompt";

@Injectable()
export class RequirementService {
  private model = createChatModel();

  private prompt = ChatPromptTemplate.fromMessages([
    ["system", REQUIREMENT_SYSTEM_PROMPT],
    ["human", REQUIREMENT_USER_TEMPLATE],
  ]);

  async extract(input: string): Promise<RequirementResult> {
    if (!input?.trim()) {
      throw new BadRequestException("input is required");
    }

    const messages = await this.prompt.formatMessages({ input });
    const structuredModel = this.model.withStructuredOutput(
      RequirementResultSchema
    );

    try {
      return await structuredModel.invoke(messages);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "structured extract failed";
      throw new Error(`Requirement extract failed: ${message}`);
    }
  }
}
```

Update `services/api/src/llm/llm.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { LlmService } from "./llm.service";
import { RequirementService } from "./requirement.service";

@Module({
  providers: [LlmService, RequirementService],
  exports: [LlmService, RequirementService],
})
export class LlmModule {}
```

Update `services/api/src/app.controller.ts`:

```ts
import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { AppService } from "./app.service";
import { RequirementService } from "./llm/requirement.service";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly requirementService: RequirementService
  ) {}

  @Get("health")
  getHealth() {
    return this.appService.getHealth();
  }

  @Post("requirement/extract")
  async extract(@Body() body: { input?: string }) {
    if (!body?.input?.trim()) {
      throw new BadRequestException("input is required");
    }
    return this.requirementService.extract(body.input);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd services/api && bun test test/requirement.spec.ts`
Expected: empty-input PASS; LLM case PASS or skip

- [ ] **Step 5: Manual curl (when key present)**

Ensure `services/api/.env` has keys (never commit). Start API, then:

```bash
curl -s -X POST http://localhost:3001/requirement/extract \
  -H "Content-Type: application/json" \
  -d '{"input":"用户注册时必须绑定手机号，密码至少8位"}'
```

Expected JSON with `action` / `constraints` / `entities`.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/llm/requirement.service.ts \
  services/api/src/llm/llm.module.ts \
  services/api/src/app.controller.ts \
  services/api/test/requirement.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): expose POST /requirement/extract with structured output

Formal path uses prompt templates and withStructuredOutput only.
EOF
)"
```

---

### Task 9: Scaffold `@autix/web` extract UI

**Files:**
- Create: `clients/web/package.json`
- Create: `clients/web/tsconfig.json`
- Create: `clients/web/next.config.ts`
- Create: `clients/web/next-env.d.ts`
- Create: `clients/web/app/layout.tsx`
- Create: `clients/web/app/page.tsx`
- Create: `clients/web/.env.example`

**Interfaces:**
- Consumes: `POST ${NEXT_PUBLIC_API_BASE_URL}/requirement/extract`
- Produces: page with textarea + submit + JSON preview; default sample input

- [ ] **Step 1: Scaffold package from chat-web**

Create `clients/web/package.json`:

```json
{
  "name": "@autix/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "wait-on tcp:3001 && next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@autix/contracts": "workspace:*",
    "next": "16.2.3",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5.7.0",
    "wait-on": "^9.0.5"
  }
}
```

Copy `tsconfig.json` / `next-env.d.ts` from `clients/chat-web` (adjust name references if any).

Create `clients/web/next.config.ts`:

```ts
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@autix/contracts"],
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001",
  },
};

export default nextConfig;
```

Create `clients/web/.env.example`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

Create `clients/web/app/layout.tsx`:

```tsx
import type { ReactNode } from "react";

export const metadata = {
  title: "Requirement Extract",
  description: "AI Agents practice — LangChain chapter 3",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Implement page**

Create `clients/web/app/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { RequirementResult } from "@autix/contracts";

const DEFAULT_INPUT = "用户注册时必须绑定手机号，密码至少8位";

export default function Home() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [result, setResult] = useState<RequirementResult | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/requirement/extract`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        }
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as RequirementResult;
      setResult(data);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Requirement Extract Demo</h1>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={8}
        style={{ width: "100%" }}
      />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "提取中…" : "提取"}
        </button>
      </div>
      {error ? <pre style={{ color: "crimson" }}>{error}</pre> : null}
      <pre style={{ marginTop: 16 }}>{JSON.stringify(result, null, 2)}</pre>
    </main>
  );
}
```

Run: `bun install` from repo root.

- [ ] **Step 3: Typecheck web**

Run: `bun run --cwd clients/web typecheck`
Expected: PASS

- [ ] **Step 4: Manual E2E smoke (with API key)**

Terminal A: `bun run dev:api`  
Terminal B: `bun run dev:web`  
Open `http://localhost:3000`, click 提取, confirm JSON fields render.

- [ ] **Step 5: Commit**

```bash
git add clients/web package.json bun.lock
git commit -m "$(cat <<'EOF'
feat(web): add Requirement Extract demo client on port 3000

Thin UI posts to /requirement/extract and renders structured JSON.
EOF
)"
```

---

### Task 10: Final verification against acceptance checklist

**Files:**
- Modify: none unless fixes needed

**Interfaces:**
- Consumes: all prior tasks
- Produces: green checklist matching the design spec

- [ ] **Step 1: Run full API tests from `services/api`**

```bash
cd services/api && bun test
```

Expected: all non-LLM tests PASS; LLM tests PASS or skip cleanly when no key

- [ ] **Step 2: Typecheck packages**

```bash
bun run typecheck --filter=@autix/api --filter=@autix/web --filter=@autix/contracts
```

Expected: PASS

- [ ] **Step 3: Confirm no demo Controllers**

```bash
rg "api/langchain|prompt-preview|tool-bind|chain-invoke" services/api/src -n || true
```

Expected: no Controller route matches (only Service method names may appear)

- [ ] **Step 4: Confirm chat untouched**

```bash
git diff main -- services/chat clients/chat-web || git diff feat/foundation -- services/chat clients/chat-web
```

Expected: no unintended chat changes (or empty)

- [ ] **Step 5: Acceptance checklist**

Mark each true:

1. Branch `feat/LangChain`
2. API :3001 + Web :3000 via `dev:api` / `dev:web` / `dev:langchain`
3. Env secrets + YAML runtime config
4. `createChatModel()` only construction path
5. Demos Service-only
6. `POST /requirement/extract` stable JSON
7. Contracts Zod schemas exported
8. Chat behavior unchanged

- [ ] **Step 6: Final commit if any fixups**

```bash
git add -A
git status
# only commit if there are fixups
git commit -m "$(cat <<'EOF'
chore(api): polish LangChain ch3 acceptance gaps

EOF
)"
```

---

## Self-Review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| New `@autix/api` + `@autix/web` | 1, 9 |
| Ports 3001 / 3000 | 1, 9 |
| Config env + YAML | 3 |
| `createChatModel()` | 4 |
| Prompt templates | 6 |
| Chain demos | 6 |
| Structured formal extract | 8 |
| Tools demo-only | 5, 7 |
| No demo Controllers | 8, 10 |
| `POST /requirement/extract` | 8 |
| Contracts schemas | 2 |
| Frontend thin UI | 9 |
| Tests + skip without key | 5, 8, 10 |
| Chat unchanged | Global + 10 |
| Root `dev:api` / `dev:web` / `dev:langchain` | 1, 9 |

No TBD/placeholder steps remain. Method names are consistent across tasks (`extract`, `invokeDemo`, `toolLoopDemo`, etc.).
