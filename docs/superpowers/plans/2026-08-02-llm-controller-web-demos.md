# LlmController HTTP + Web LangChain Demos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为已有 `LlmService` 暴露 `/api/langchain/*` HTTP 路由，并在 `@autix/web` 新增 `/langchain` demo 页调用这些接口。

**Architecture:** 新建薄 `LlmController`（`@Controller('api/langchain')`）1:1 转调 `LlmService`；`stream` / `chain-stream` 用 SSE；Web 保留 `/` extract，新增 `/langchain` 用 select 切换能力。不做 `/structured`（正式入口仍是 `/requirement/extract`）。

**Tech Stack:** NestJS 11, Bun test, Next.js 16 (App Router), LangChain (existing `LlmService`), Express `Response` for SSE

**Spec:** `docs/superpowers/specs/2026-08-01-llm-controller-web-demos-design.md`

## Global Constraints

- Branch: `feat/LangChain`
- API prefix: `@Controller('api/langchain')` — ten routes listed in spec; **no** `/api/langchain/structured`
- Thin controller only — do not rewrite `LlmService` business logic; wrap return shapes at controller when needed
- Sample default input: `用户注册时必须绑定手机号，密码至少8位`
- Empty `input` / empty `inputs` → `400 BadRequestException`
- LLM/service failures on JSON routes → `500 InternalServerErrorException` with short message
- CORS already enabled in `main.ts` — do not change
- Do not change `RequirementService` / `POST /requirement/extract` contract
- Do not change `@autix/chat` / `@autix/chat-web`
- Tests: `bun test` under `services/api`
- No auth, rate limit, DTO validation library, or UI redesign

---

## File Structure (locked)

| Path | Responsibility |
|------|----------------|
| `services/api/src/llm/llm.controller.ts` | HTTP routes → `LlmService` |
| `services/api/src/llm/llm.module.ts` | Register `controllers: [LlmController]` |
| `services/api/test/llm.controller.spec.ts` | Controller validation + prompt-preview (no API key) |
| `clients/web/app/langchain/page.tsx` | Demo selector UI |
| `clients/web/app/page.tsx` | Add link to `/langchain` |

Unchanged (consumed as-is): `llm.service.ts`, `requirement.service.ts`, `app.controller.ts`, `main.ts`.

### Service → HTTP mapping (reference)

| Route | Method | Body | Controller return |
|-------|--------|------|-------------------|
| `POST invoke` | `invokeDemo` | `{ input }` | `{ result }` |
| `POST stream` | `streamDemo` | `{ input }` | SSE chunks |
| `POST batch` | `batchDemo` | `{ inputs }` | `{ results }` |
| `POST prompt-preview` | `promptPreview` | `{ input }` | `{ rendered }` |
| `POST prompt-to-model` | `promptToModel` | `{ input }` | `{ result }` |
| `POST chain-invoke` | `chainInvoke` | `{ input }` | `{ result }` |
| `POST chain-stream` | `chainStream` | `{ input }` | SSE chunks |
| `POST chain-batch` | `chainBatch` | `{ inputs }` | `{ results }` (service already wraps) |
| `POST tool-bind` | `toolBindDemo` | `{ input }` | `{ result, toolCalls }` |
| `POST tool-loop` | `toolLoopDemo` | `{ input }` | `{ result }` |

---

### Task 1: LlmController skeleton + prompt-preview + module wiring

**Files:**
- Create: `services/api/src/llm/llm.controller.ts`
- Create: `services/api/test/llm.controller.spec.ts`
- Modify: `services/api/src/llm/llm.module.ts`

**Interfaces:**
- Consumes: `LlmService.promptPreview(input: string): Promise<{ rendered: string }>`
- Produces: `LlmController` with `promptPreview` route; helpers `requireInput` / `requireInputs`; module registers controller

- [ ] **Step 1: Write the failing controller tests**

Create `services/api/test/llm.controller.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { BadRequestException } from "@nestjs/common";
import { LlmController } from "../src/llm/llm.controller";
import { LlmService } from "../src/llm/llm.service";

const SAMPLE = "用户注册时必须绑定手机号，密码至少8位";

describe("LlmController", () => {
  test("prompt-preview rejects empty input", async () => {
    const controller = new LlmController(new LlmService());
    await expect(controller.promptPreview({ input: "  " })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  test("batch rejects empty inputs", async () => {
    const controller = new LlmController(new LlmService());
    await expect(controller.batch({ inputs: [] })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  test("prompt-preview renders without calling the model", async () => {
    const controller = new LlmController(new LlmService());
    const { rendered } = await controller.promptPreview({ input: SAMPLE });
    expect(rendered).toContain(SAMPLE);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd services/api && bun test test/llm.controller.spec.ts
```

Expected: FAIL — cannot find module `../src/llm/llm.controller` (or `LlmController` undefined).

- [ ] **Step 3: Implement controller skeleton + prompt-preview + batch validation stub**

Create `services/api/src/llm/llm.controller.ts`:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Post,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { LlmService } from "./llm.service";

@Controller("api/langchain")
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  private requireInput(body: { input?: string }): string {
    if (!body?.input?.trim()) {
      throw new BadRequestException("input is required");
    }
    return body.input.trim();
  }

  private requireInputs(body: { inputs?: string[] }): string[] {
    if (!Array.isArray(body?.inputs) || body.inputs.length === 0) {
      throw new BadRequestException("inputs is required");
    }
    const inputs = body.inputs
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
    if (inputs.length === 0) {
      throw new BadRequestException("inputs is required");
    }
    return inputs;
  }

  private wrapError(error: unknown, fallback: string): never {
    const message = error instanceof Error ? error.message : fallback;
    throw new InternalServerErrorException(message);
  }

  @Post("prompt-preview")
  async promptPreview(@Body() body: { input?: string }) {
    const input = this.requireInput(body);
    try {
      return await this.llmService.promptPreview(input);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.wrapError(error, "prompt-preview failed");
    }
  }

  @Post("batch")
  async batch(@Body() body: { inputs?: string[] }) {
    const inputs = this.requireInputs(body);
    try {
      const results = await this.llmService.batchDemo(inputs);
      return { results };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.wrapError(error, "batch failed");
    }
  }
}
```

Note: `batch` is included here so the empty-inputs test compiles and passes; remaining routes land in Task 2–3.

Update `services/api/src/llm/llm.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { LlmController } from "./llm.controller";
import { LlmService } from "./llm.service";
import { RequirementService } from "./requirement.service";

@Module({
  controllers: [LlmController],
  providers: [LlmService, RequirementService],
  exports: [LlmService, RequirementService],
})
export class LlmModule {}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd services/api && bun test test/llm.controller.spec.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add \
  services/api/src/llm/llm.controller.ts \
  services/api/src/llm/llm.module.ts \
  services/api/test/llm.controller.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): add LlmController with prompt-preview and batch validation

EOF
)"
```

---

### Task 2: Remaining JSON demo routes

**Files:**
- Modify: `services/api/src/llm/llm.controller.ts`
- Modify: `services/api/test/llm.controller.spec.ts`

**Interfaces:**
- Consumes: `invokeDemo`, `batchDemo` (already wired), `promptToModel`, `chainInvoke`, `chainBatch`, `toolBindDemo`, `toolLoopDemo`
- Produces: JSON routes for invoke / prompt-to-model / chain-invoke / chain-batch / tool-bind / tool-loop

- [ ] **Step 1: Extend tests for route method presence and invoke wrap shape (mocked)**

Append to `services/api/test/llm.controller.spec.ts`:

```ts
test("invoke wraps string result", async () => {
  const service = {
    invokeDemo: async () => "ok-result",
  } as unknown as LlmService;
  const controller = new LlmController(service);
  await expect(controller.invoke({ input: SAMPLE })).resolves.toEqual({
    result: "ok-result",
  });
});

test("chain-batch rejects missing inputs", async () => {
  const controller = new LlmController(new LlmService());
  await expect(controller.chainBatch({})).rejects.toBeInstanceOf(
    BadRequestException
  );
});
```

- [ ] **Step 2: Run tests to verify new cases fail**

Run:

```bash
cd services/api && bun test test/llm.controller.spec.ts
```

Expected: FAIL — `controller.invoke` / `controller.chainBatch` is not a function.

- [ ] **Step 3: Add remaining JSON routes to controller**

Replace / extend `services/api/src/llm/llm.controller.ts` so the class includes (keep helpers + `promptPreview` + `batch` from Task 1):

```ts
  @Post("invoke")
  async invoke(@Body() body: { input?: string }) {
    const input = this.requireInput(body);
    try {
      const result = await this.llmService.invokeDemo(input);
      return { result };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.wrapError(error, "invoke failed");
    }
  }

  @Post("prompt-to-model")
  async promptToModel(@Body() body: { input?: string }) {
    const input = this.requireInput(body);
    try {
      return await this.llmService.promptToModel(input);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.wrapError(error, "prompt-to-model failed");
    }
  }

  @Post("chain-invoke")
  async chainInvoke(@Body() body: { input?: string }) {
    const input = this.requireInput(body);
    try {
      return await this.llmService.chainInvoke(input);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.wrapError(error, "chain-invoke failed");
    }
  }

  @Post("chain-batch")
  async chainBatch(@Body() body: { inputs?: string[] }) {
    const inputs = this.requireInputs(body);
    try {
      return await this.llmService.chainBatch(inputs);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.wrapError(error, "chain-batch failed");
    }
  }

  @Post("tool-bind")
  async toolBind(@Body() body: { input?: string }) {
    const input = this.requireInput(body);
    try {
      return await this.llmService.toolBindDemo(input);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.wrapError(error, "tool-bind failed");
    }
  }

  @Post("tool-loop")
  async toolLoop(@Body() body: { input?: string }) {
    const input = this.requireInput(body);
    try {
      return await this.llmService.toolLoopDemo(input);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.wrapError(error, "tool-loop failed");
    }
  }
```

Do **not** add stream routes yet (Task 3). Keep `batch` and `promptPreview` as in Task 1.

- [ ] **Step 4: Run controller tests**

Run:

```bash
cd services/api && bun test test/llm.controller.spec.ts
```

Expected: PASS (all tests in this file).

- [ ] **Step 5: Typecheck**

Run:

```bash
cd services/api && bun run typecheck
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add \
  services/api/src/llm/llm.controller.ts \
  services/api/test/llm.controller.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): expose JSON langchain demo routes on LlmController

EOF
)"
```

---

### Task 3: SSE stream + chain-stream routes

**Files:**
- Modify: `services/api/src/llm/llm.controller.ts`
- Modify: `services/api/test/llm.controller.spec.ts`

**Interfaces:**
- Consumes: `streamDemo(input)` → async iterable of chunks with `.content`; `chainStream(input)` → async iterable of string (or stringifiable) chunks
- Produces: `POST stream`, `POST chain-stream` writing `text/event-stream`

- [ ] **Step 1: Write failing stream validation + mock stream write test**

Append to `services/api/test/llm.controller.spec.ts`:

```ts
test("stream rejects empty input", async () => {
  const controller = new LlmController(new LlmService());
  const res = {
    setHeader() {},
    write() {},
    end() {},
  } as unknown as import("express").Response;
  await expect(
    controller.stream({ input: "" }, res)
  ).rejects.toBeInstanceOf(BadRequestException);
});

test("stream writes chunk contents then ends", async () => {
  const chunks: string[] = [];
  let ended = false;
  const service = {
    streamDemo: async function* () {
      yield { content: "hello" };
      yield { content: " world" };
    },
  } as unknown as LlmService;
  const controller = new LlmController(service);
  const res = {
    setHeader() {},
    write(data: string) {
      chunks.push(String(data));
    },
    end() {
      ended = true;
    },
  } as unknown as import("express").Response;

  await controller.stream({ input: SAMPLE }, res);
  expect(chunks.join("")).toBe("hello world");
  expect(ended).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd services/api && bun test test/llm.controller.spec.ts
```

Expected: FAIL — `controller.stream` is not a function.

- [ ] **Step 3: Implement stream routes**

Add to `LlmController` in `services/api/src/llm/llm.controller.ts`:

```ts
  @Post("stream")
  async stream(
    @Body() body: { input?: string },
    @Res() res: Response
  ) {
    const input = this.requireInput(body);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const stream = await this.llmService.streamDemo(input);
      for await (const chunk of stream) {
        const text =
          typeof chunk?.content === "string"
            ? chunk.content
            : String(chunk?.content ?? "");
        if (text) res.write(text);
      }
      res.end();
    } catch (error) {
      if (!res.headersSent) {
        const message =
          error instanceof Error ? error.message : "stream failed";
        throw new InternalServerErrorException(message);
      }
      res.end();
    }
  }

  @Post("chain-stream")
  async chainStream(
    @Body() body: { input?: string },
    @Res() res: Response
  ) {
    const input = this.requireInput(body);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const stream = await this.llmService.chainStream(input);
      for await (const chunk of stream) {
        res.write(typeof chunk === "string" ? chunk : String(chunk ?? ""));
      }
      res.end();
    } catch (error) {
      if (!res.headersSent) {
        const message =
          error instanceof Error ? error.message : "chain-stream failed";
        throw new InternalServerErrorException(message);
      }
      res.end();
    }
  }
```

Ensure `Response` is imported from `express` and `@Res` from `@nestjs/common` (already in Task 1 imports).

- [ ] **Step 4: Run controller tests**

Run:

```bash
cd services/api && bun test test/llm.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Manual smoke (optional if API key present)**

```bash
# terminal A
cd services/api && bun run dev

# terminal B
curl -s -X POST http://localhost:3001/api/langchain/prompt-preview \
  -H "Content-Type: application/json" \
  -d '{"input":"用户注册时必须绑定手机号，密码至少8位"}'
```

Expected: JSON with `rendered` containing the sample input.

- [ ] **Step 6: Commit**

```bash
git add \
  services/api/src/llm/llm.controller.ts \
  services/api/test/llm.controller.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): add SSE stream and chain-stream langchain routes

EOF
)"
```

---

### Task 4: Web `/langchain` demo page + nav links

**Files:**
- Create: `clients/web/app/langchain/page.tsx`
- Modify: `clients/web/app/page.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_API_BASE_URL` + all ten `/api/langchain/*` routes from Tasks 1–3
- Produces: `/langchain` client page; home link ↔ langchain link

- [ ] **Step 1: Create langchain demo page**

Create `clients/web/app/langchain/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

const DEFAULT_INPUT = "用户注册时必须绑定手机号，密码至少8位";

const DEMOS = [
  { id: "invoke", path: "/api/langchain/invoke", kind: "input" as const },
  { id: "stream", path: "/api/langchain/stream", kind: "stream" as const },
  { id: "batch", path: "/api/langchain/batch", kind: "batch" as const },
  {
    id: "prompt-preview",
    path: "/api/langchain/prompt-preview",
    kind: "input" as const,
  },
  {
    id: "prompt-to-model",
    path: "/api/langchain/prompt-to-model",
    kind: "input" as const,
  },
  {
    id: "chain-invoke",
    path: "/api/langchain/chain-invoke",
    kind: "input" as const,
  },
  {
    id: "chain-stream",
    path: "/api/langchain/chain-stream",
    kind: "stream" as const,
  },
  {
    id: "chain-batch",
    path: "/api/langchain/chain-batch",
    kind: "batch" as const,
  },
  {
    id: "tool-bind",
    path: "/api/langchain/tool-bind",
    kind: "input" as const,
  },
  {
    id: "tool-loop",
    path: "/api/langchain/tool-loop",
    kind: "input" as const,
  },
] as const;

type DemoId = (typeof DEMOS)[number]["id"];

export default function LangChainDemosPage() {
  const [demoId, setDemoId] = useState<DemoId>("invoke");
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const demo = DEMOS.find((item) => item.id === demoId)!;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;

  async function handleSubmit() {
    setLoading(true);
    setError("");
    setResult("");
    try {
      const body =
        demo.kind === "batch"
          ? {
              inputs: input
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            }
          : { input };

      const res = await fetch(`${base}${demo.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      if (demo.kind === "stream") {
        const reader = res.body?.getReader();
        if (!reader) throw new Error("no response body");
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setResult(acc);
        }
        return;
      }

      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult("");
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>LangChain Demos</h1>
      <p>
        <Link href="/">← Requirement Extract</Link>
      </p>
      <label style={{ display: "block", marginBottom: 8 }}>
        Demo{" "}
        <select
          value={demoId}
          onChange={(e) => setDemoId(e.target.value as DemoId)}
        >
          {DEMOS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </select>
      </label>
      <p style={{ color: "#666", fontSize: 14 }}>
        {demo.kind === "batch"
          ? "Batch：每行一条输入"
          : demo.kind === "stream"
            ? "Stream：响应将逐块追加显示"
            : "单条 input"}
      </p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={8}
        style={{ width: "100%" }}
      />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "请求中…" : "运行"}
        </button>
      </div>
      {error ? <pre style={{ color: "crimson" }}>{error}</pre> : null}
      <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{result}</pre>
    </main>
  );
}
```

- [ ] **Step 2: Add nav link on home page**

In `clients/web/app/page.tsx`, add `import Link from "next/link";` and inside `<main>`, after `<h1>`:

```tsx
      <p>
        <Link href="/langchain">LangChain Demos →</Link>
      </p>
```

Full updated return block for clarity:

```tsx
  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Requirement Extract Demo</h1>
      <p>
        <Link href="/langchain">LangChain Demos →</Link>
      </p>
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
```

- [ ] **Step 3: Typecheck web**

Run:

```bash
cd clients/web && bun run typecheck
```

Expected: exit 0.

- [ ] **Step 4: Manual check (optional)**

```bash
# from repo root, with API env configured
bun run dev:api   # or package script equivalent
bun run dev:web
```

Open `http://localhost:3000/langchain`, select `prompt-preview`, click 运行 — should show rendered prompt JSON/text containing the sample.

- [ ] **Step 5: Commit**

```bash
git add \
  clients/web/app/langchain/page.tsx \
  clients/web/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): add /langchain page to call LlmController demos

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `LlmController` + `@Controller('api/langchain')` | 1 |
| Register in `LlmModule` | 1 |
| `prompt-preview`, `batch` + empty validation | 1 |
| invoke / prompt-to-model / chain-invoke / chain-batch / tool-bind / tool-loop | 2 |
| stream / chain-stream SSE | 3 |
| No `/structured` | — (never added) |
| Web `/langchain` select + batch line-split + stream reader | 4 |
| Home ↔ langchain links | 4 |
| Keep `/requirement/extract` | — (untouched) |
| Controller tests (empty → 400, prompt-preview no key) | 1–3 |

## Self-review notes

- No TBD/placeholder steps; full controller and page code included
- Return shapes match spec table (`batch` wraps `{ results }`; `chainBatch` uses service `{ results }`)
- Stream chunk handling covers AIMessageChunk `.content` and string chain chunks
- Previous ch3 plan’s “no demo Controllers” is superseded by this plan’s spec
