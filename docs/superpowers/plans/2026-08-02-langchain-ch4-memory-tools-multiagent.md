# LangChain Ch4 Memory / Tools / Multi-Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `@autix/api` 落地第四章：进程内 Memory、业务 Tools、本地 Embedding + MemoryVectorStore、Fixed Workflow 五 Agent，以及统一 `POST /api/advanced/analyze`，并保留各能力单点验收路由。

**Architecture:** 新建 `AdvancedModule`（与第三章 `LlmModule` 并存），按 `memory` / `filesystem` / `embedding` / `agents` 拆 Controller；复用 `createChatModel()`；业务数据落在 `services/api/workspace/`；`analyze()` 串联 Memory → Orchestrator → 安全写 tickets → `appendMessage`，不嵌 Tools/Embedding。

**Tech Stack:** Bun, NestJS 11, LangChain (`@langchain/core` / `langchain` / `@langchain/community` / `@langchain/classic` as needed), `@xenova/transformers`, Zod, bun:test

**Spec:** `docs/superpowers/specs/2026-08-02-langchain-ch4-memory-tools-multiagent-design.md`

## Scope note

Spec 覆盖 5 个子系统。按 brainstorming 锁定决策，本文件用 **一个计划、顺序 Task** 交付；Task 2–6 各自结束后都可用 curl 独立验收。若中途想拆成多份 plan，可按 Task 边界切开，不必改设计。

## Global Constraints

- Branch: `feat/LangChain-Advanced`
- Spec path: `docs/superpowers/specs/2026-08-02-langchain-ch4-memory-tools-multiagent-design.md`
- API port: `3001`（验收 curl 一律用 3001，不用课本里的 3000）
- Storage: `InMemoryChatMessageHistory` + `MemoryVectorStore` only（无 DB / Redis / pgvector）
- Never `new ChatOpenAI` outside `createChatModel()`
- Do not change behavior of existing `LlmModule` / `LlmController` / `RequirementService`
- Frontend: none
- `analyze()` must not call Tools tool-loop or Embedding search
- Tests: `bun test` under `services/api`
- Embeddings: prefer `HuggingFaceTransformersEmbeddings`; fallback direct `@xenova/transformers` pipeline with same `embedQuery` / `embedDocuments` API
- Case order id: `EC20240315001`; product id: `headphone-x1`

---

## File Structure (locked)

| Path | Responsibility |
|------|----------------|
| `services/api/workspace/orders/EC20240315001.json` | Seed order |
| `services/api/workspace/products/headphone-x1.json` | Seed product |
| `services/api/workspace/policies/return-policy.md` | Return policy |
| `services/api/workspace/policies/refund-policy.md` | Refund policy |
| `services/api/workspace/faq/after-sale-faq.md` | After-sale FAQ |
| `services/api/workspace/tickets/` | Runtime ticket writes |
| `.gitignore` | Ignore `services/api/workspace/tickets/*` (keep dir via `.gitkeep`) |
| `services/api/src/llm/tools/business.tools.ts` | Four tools + exported `safePath` / `WORKSPACE_ROOT` |
| `services/api/src/llm/memory/runnable-memory.service.ts` | Session memory + trim |
| `services/api/src/llm/memory/memory.controller.ts` | `/api/memory` |
| `services/api/src/llm/filesystem/filesystem.service.ts` | Tool-loop + `writeWorkspaceFile` |
| `services/api/src/llm/filesystem/files.controller.ts` | `/api/files` |
| `services/api/src/llm/embedding/embedding.service.ts` | Local embeddings |
| `services/api/src/llm/embedding/vector-store.service.ts` | In-memory vector store |
| `services/api/src/llm/embedding/embedding.controller.ts` | `/api/embedding` |
| `services/api/src/llm/agents/clarification.ts` | Pure clarification helper (unit-tested) |
| `services/api/src/llm/agents/sub-agents.ts` | Five agent chains |
| `services/api/src/llm/agents/orchestrator.service.ts` | Fixed workflow |
| `services/api/src/llm/agents/agents.controller.ts` | `/api/agents` |
| `services/api/src/llm/advanced-analysis.service.ts` | `analyze()` |
| `services/api/src/llm/advanced.controller.ts` | `/api/advanced` |
| `services/api/src/llm/advanced.module.ts` | Register all Ch4 providers/controllers |
| `services/api/src/app.module.ts` | Import `AdvancedModule` |
| `services/api/test/business.tools.spec.ts` | `safePath` + tool read/write |
| `services/api/test/memory.service.spec.ts` | History / append / clear (no LLM) |
| `services/api/test/clarification.spec.ts` | Clarification questions |
| `services/api/test/advanced-analysis.spec.ts` | Analyze clarification skips write |

---

### Task 1: Dependencies, workspace seeds, AdvancedModule skeleton

**Files:**
- Modify: `services/api/package.json`
- Modify: `.gitignore`
- Create: `services/api/workspace/orders/EC20240315001.json`
- Create: `services/api/workspace/products/headphone-x1.json`
- Create: `services/api/workspace/policies/return-policy.md`
- Create: `services/api/workspace/policies/refund-policy.md`
- Create: `services/api/workspace/faq/after-sale-faq.md`
- Create: `services/api/workspace/tickets/.gitkeep`
- Create: `services/api/src/llm/advanced.module.ts`
- Modify: `services/api/src/app.module.ts`

**Interfaces:**
- Consumes: existing `AppModule` / `LlmModule`
- Produces: empty `AdvancedModule` registered; seed files on disk; deps installed

- [ ] **Step 1: Install dependencies**

From repo root:

```bash
cd services/api && bun add @langchain/community @xenova/transformers @langchain/classic
```

If install fails on a package, stop and resolve version against current `langchain@^1.5.4` before continuing.

- [ ] **Step 2: Add gitignore for ticket artifacts**

Append to `.gitignore`:

```gitignore
# Ch4 runtime ticket artifacts
services/api/workspace/tickets/*
!services/api/workspace/tickets/.gitkeep
```

- [ ] **Step 3: Create seed files**

`services/api/workspace/orders/EC20240315001.json`:

```json
{
  "orderId": "EC20240315001",
  "productId": "headphone-x1",
  "productName": "蓝牙降噪耳机 X1",
  "status": "delivered",
  "receivedAt": "2024-03-14",
  "amount": 299,
  "buyer": "demo-user"
}
```

`services/api/workspace/products/headphone-x1.json`:

```json
{
  "productId": "headphone-x1",
  "name": "蓝牙降噪耳机 X1",
  "category": "耳机",
  "warrantyDays": 365,
  "returnable": true,
  "notes": "七天无理由退货需未拆封且不影响二次销售"
}
```

`services/api/workspace/policies/return-policy.md`:

```markdown
# 退货政策

- 支持 7 天无理由退货
- 商品需未拆封，且不影响二次销售
- 质量问题可申请退货或换货
```

`services/api/workspace/policies/refund-policy.md`:

```markdown
# 退款政策

- 退款将在审核通过后 3 个工作日内原路退回
- 未拆封商品优先走无理由退货流程
```

`services/api/workspace/faq/after-sale-faq.md`:

```markdown
# 售后 FAQ

- 蓝牙耳机降噪问题属于质量投诉，可申请退货或换货
- 未拆封商品在签收 7 天内可申请无理由退货
```

Create empty `services/api/workspace/tickets/.gitkeep`.

- [ ] **Step 4: Scaffold AdvancedModule and wire AppModule**

Create `services/api/src/llm/advanced.module.ts`:

```ts
import { Module } from "@nestjs/common";

@Module({
  controllers: [],
  providers: [],
  exports: [],
})
export class AdvancedModule {}
```

Modify `services/api/src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { LlmModule } from "./llm/llm.module";
import { AdvancedModule } from "./llm/advanced.module";

@Module({
  imports: [LlmModule, AdvancedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 5: Verify seeds and typecheck**

```bash
test -f services/api/workspace/orders/EC20240315001.json && echo ok
cd services/api && bun run typecheck
```

Expected: `ok` and typecheck exit 0.

- [ ] **Step 6: Commit**

```bash
git add .gitignore services/api/package.json services/api/bun.lock services/api/workspace services/api/src/llm/advanced.module.ts services/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
chore(api): scaffold Ch4 workspace seeds and AdvancedModule

EOF
)"
```

If lockfile lives at repo root, add that path instead.

---

### Task 2: Business tools + safePath

**Files:**
- Create: `services/api/src/llm/tools/business.tools.ts`
- Create: `services/api/test/business.tools.spec.ts`

**Interfaces:**
- Consumes: Node `fs` / `path`; workspace at `path.join(process.cwd(), "workspace")`
- Produces:
  - `export const WORKSPACE_ROOT: string`
  - `export function safePath(filePath: string): string`
  - `export const queryOrderTool`
  - `export const queryProductTool`
  - `export const readFileTool`
  - `export const writeFileTool`
  - `export const businessTools` (array of the four)

- [ ] **Step 1: Write the failing test**

Create `services/api/test/business.tools.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  queryOrderTool,
  readFileTool,
  safePath,
  writeFileTool,
} from "../src/llm/tools/business.tools";

describe("business tools", () => {
  test("safePath rejects workspace escape", () => {
    expect(() => safePath("../../../etc/passwd")).toThrow(
      "路径不允许逃逸工作目录"
    );
  });

  test("query_order returns seed order", async () => {
    const result = await queryOrderTool.invoke({ orderId: "EC20240315001" });
    expect(result.orderId).toBe("EC20240315001");
    expect(result.productId).toBe("headphone-x1");
  });

  test("read_file returns return policy", async () => {
    const result = await readFileTool.invoke({
      filePath: "policies/return-policy.md",
    });
    expect(result.content).toContain("7 天无理由退货");
  });

  test("write_file writes under tickets and can be read back", async () => {
    const filePath = "tickets/_unit-test.md";
    await writeFileTool.invoke({ filePath, content: "unit-test-content" });
    const full = path.join(process.cwd(), "workspace", filePath);
    expect(fs.readFileSync(full, "utf8")).toBe("unit-test-content");
    fs.unlinkSync(full);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/api && bun test test/business.tools.spec.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement business tools**

Create `services/api/src/llm/tools/business.tools.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

export const WORKSPACE_ROOT = path.join(process.cwd(), "workspace");

export function safePath(filePath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, filePath);
  const root = path.resolve(WORKSPACE_ROOT);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("路径不允许逃逸工作目录");
  }
  return resolved;
}

export const queryOrderTool = tool(
  async ({ orderId }: { orderId: string }) => {
    const full = safePath(`orders/${orderId}.json`);
    if (!fs.existsSync(full)) return { error: `订单 ${orderId} 不存在` };
    return JSON.parse(fs.readFileSync(full, "utf8"));
  },
  {
    name: "query_order",
    description: "根据订单号查询订单详情、商品、收货时间和状态",
    schema: z.object({
      orderId: z.string().describe("订单号，例如 EC20240315001"),
    }),
  }
);

export const queryProductTool = tool(
  async ({ productId }: { productId: string }) => {
    const full = safePath(`products/${productId}.json`);
    if (!fs.existsSync(full)) return { error: `商品 ${productId} 不存在` };
    return JSON.parse(fs.readFileSync(full, "utf8"));
  },
  {
    name: "query_product",
    description: "根据商品 ID 查询参数、保修和售后信息",
    schema: z.object({
      productId: z.string().describe("商品 ID，例如 headphone-x1"),
    }),
  }
);

export const readFileTool = tool(
  async ({ filePath }: { filePath: string }) => {
    const full = safePath(filePath);
    if (!fs.existsSync(full)) return { error: "文件不存在" };
    return { content: fs.readFileSync(full, "utf8") };
  },
  {
    name: "read_file",
    description: "读取政策、FAQ 或其他业务文件",
    schema: z.object({
      filePath: z.string().describe("相对于 workspace 的文件路径"),
    }),
  }
);

export const writeFileTool = tool(
  async ({ filePath, content }: { filePath: string; content: string }) => {
    const full = safePath(filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
    return { success: true, path: filePath };
  },
  {
    name: "write_file",
    description: "写入工单、售后报告或日报",
    schema: z.object({
      filePath: z.string().describe("相对于 workspace 的文件路径"),
      content: z.string().describe("要写入的内容"),
    }),
  }
);

export const businessTools = [
  queryOrderTool,
  queryProductTool,
  readFileTool,
  writeFileTool,
];
```

Run tests from `services/api` so `process.cwd()` is the api package root.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd services/api && bun test test/business.tools.spec.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add services/api/src/llm/tools/business.tools.ts services/api/test/business.tools.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): add Ch4 business tools with workspace safePath

EOF
)"
```

---

### Task 3: Memory service + `/api/memory`

**Files:**
- Create: `services/api/src/llm/memory/runnable-memory.service.ts`
- Create: `services/api/src/llm/memory/memory.controller.ts`
- Create: `services/api/test/memory.service.spec.ts`
- Modify: `services/api/src/llm/advanced.module.ts`

**Interfaces:**
- Consumes: `createChatModel()` from `../model.factory`
- Produces `RunnableMemoryService`:
  - `chat(sessionId: string, input: string): Promise<{ response: string }>`
  - `getHistory(sessionId: string): Promise<BaseMessage[]>`
  - `appendMessage(sessionId: string, human: string, ai: string): Promise<void>`
  - `clearSession(sessionId: string): void`

- [ ] **Step 1: Write the failing test (no LLM)**

Create `services/api/test/memory.service.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { RunnableMemoryService } from "../src/llm/memory/runnable-memory.service";

describe("RunnableMemoryService history", () => {
  test("unknown session returns empty history", async () => {
    const svc = new RunnableMemoryService();
    const history = await svc.getHistory("missing");
    expect(history).toEqual([]);
  });

  test("appendMessage then clearSession", async () => {
    const svc = new RunnableMemoryService();
    await svc.appendMessage("s-test", "hello", "world");
    const history = await svc.getHistory("s-test");
    expect(history.length).toBe(2);
    svc.clearSession("s-test");
    expect(await svc.getHistory("s-test")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/api && bun test test/memory.service.spec.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement memory service + controller**

Create `services/api/src/llm/memory/runnable-memory.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { RunnablePassthrough, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { trimMessages, type BaseMessage } from "@langchain/core/messages";
import { createChatModel } from "../model.factory";

@Injectable()
export class RunnableMemoryService {
  private store = new Map<string, InMemoryChatMessageHistory>();
  private model = createChatModel();

  private prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "你是一名电商客服助手，请结合历史对话理解用户诉求并给出回答。",
    ],
    new MessagesPlaceholder("history"),
    ["human", "{input}"],
  ]);

  private getSessionHistory = (sessionId: string) => {
    if (!this.store.has(sessionId)) {
      this.store.set(sessionId, new InMemoryChatMessageHistory());
    }
    return this.store.get(sessionId)!;
  };

  private trimmer = trimMessages({
    maxTokens: 2000,
    strategy: "last",
    tokenCounter: this.model,
    includeSystem: true,
    allowPartial: false,
  });

  private chain = RunnablePassthrough.assign({
    history: async (input: { history: BaseMessage[] }) =>
      this.trimmer.invoke(input.history),
  })
    .pipe(this.prompt)
    .pipe(this.model);

  private withHistory = new RunnableWithMessageHistory({
    runnable: this.chain,
    getMessageHistory: this.getSessionHistory,
    inputMessagesKey: "input",
    historyMessagesKey: "history",
  });

  async chat(sessionId: string, input: string) {
    const response = await this.withHistory.invoke(
      { input },
      { configurable: { sessionId } }
    );
    return {
      response:
        typeof response.content === "string"
          ? response.content
          : String(response.content ?? ""),
    };
  }

  async getHistory(sessionId: string) {
    if (!this.store.has(sessionId)) return [];
    return this.getSessionHistory(sessionId).getMessages();
  }

  async appendMessage(sessionId: string, human: string, ai: string) {
    const history = this.getSessionHistory(sessionId);
    await history.addUserMessage(human);
    await history.addAIMessage(ai);
  }

  clearSession(sessionId: string) {
    this.store.delete(sessionId);
  }
}
```

If `RunnableWithMessageHistory` / `InMemoryChatMessageHistory` import paths differ in installed versions, adjust imports to the packages that actually export them; keep the public method signatures unchanged.

Create `services/api/src/llm/memory/memory.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { RunnableMemoryService } from "./runnable-memory.service";

@Controller("api/memory")
export class MemoryController {
  constructor(private readonly memory: RunnableMemoryService) {}

  @Post("chat")
  chat(@Body() body: { sessionId: string; input: string }) {
    return this.memory.chat(body.sessionId, body.input);
  }

  @Get("history")
  history(@Query("sessionId") sessionId: string) {
    return this.memory.getHistory(sessionId);
  }

  @Delete("clear")
  clear(@Query("sessionId") sessionId: string) {
    this.memory.clearSession(sessionId);
    return { cleared: true, sessionId };
  }
}
```

Update `advanced.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { RunnableMemoryService } from "./memory/runnable-memory.service";
import { MemoryController } from "./memory/memory.controller";

@Module({
  controllers: [MemoryController],
  providers: [RunnableMemoryService],
  exports: [RunnableMemoryService],
})
export class AdvancedModule {}
```

- [ ] **Step 4: Run unit tests**

```bash
cd services/api && bun test test/memory.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Manual curl smoke (requires API key)**

```bash
cd services/api && bun run dev
```

```bash
curl -s -X POST http://localhost:3001/api/memory/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"s1","input":"我买的蓝牙耳机降噪效果不好，想退货"}'
curl -s -X POST http://localhost:3001/api/memory/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"s1","input":"订单号是 EC20240315001"}'
curl -s "http://localhost:3001/api/memory/history?sessionId=s1"
curl -s -X DELETE "http://localhost:3001/api/memory/clear?sessionId=s1"
```

Expected: chat returns `{ response }`; history grows; clear empties.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/llm/memory services/api/src/llm/advanced.module.ts services/api/test/memory.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): add RunnableWithMessageHistory memory endpoints

EOF
)"
```

---

### Task 4: Filesystem tool-loop + `/api/files`

**Files:**
- Create: `services/api/src/llm/filesystem/filesystem.service.ts`
- Create: `services/api/src/llm/filesystem/files.controller.ts`
- Modify: `services/api/src/llm/advanced.module.ts`

**Interfaces:**
- Consumes: `businessTools`, `createChatModel()`, pattern from `LlmService.toolLoopDemo`
- Produces `FilesystemService`:
  - `fileChat(input: string): Promise<{ result: string }>`
  - `writeWorkspaceFile(filePath: string, content: string): Promise<{ success: true; path: string }>`

- [ ] **Step 1: Implement FilesystemService**

Create `services/api/src/llm/filesystem/filesystem.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { createChatModel } from "../model.factory";
import { businessTools, writeFileTool } from "../tools/business.tools";

@Injectable()
export class FilesystemService {
  private model = createChatModel();

  async writeWorkspaceFile(filePath: string, content: string) {
    return writeFileTool.invoke({ filePath, content }) as Promise<{
      success: true;
      path: string;
    }>;
  }

  async fileChat(input: string) {
    const tools: StructuredToolInterface[] = [...businessTools];
    const toolMap: Record<string, StructuredToolInterface> = Object.fromEntries(
      tools.map((t) => [t.name, t])
    );
    const modelWithTools = this.model.bindTools(tools);

    const messages: BaseMessage[] = [
      new SystemMessage(
        "你是电商客服助手。可以调用 query_order、query_product、read_file、write_file 工具查询订单/商品/政策并写入工单。文件路径相对于 workspace，不要带 workspace/ 前缀。"
      ),
      new HumanMessage(input),
    ];

    let response = await modelWithTools.invoke(messages);
    messages.push(response);

    let guard = 0;
    while ((response.tool_calls?.length ?? 0) > 0 && guard < 5) {
      for (const toolCall of response.tool_calls ?? []) {
        const target = toolMap[toolCall.name];
        if (!target) continue;
        try {
          const toolResult = await target.invoke(toolCall.args);
          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id!,
              content: JSON.stringify(toolResult),
            })
          );
        } catch (error) {
          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id!,
              content: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            })
          );
        }
      }
      response = await modelWithTools.invoke(messages);
      messages.push(response);
      guard += 1;
    }

    return {
      result:
        response.content?.toString?.() ?? String(response.content ?? ""),
    };
  }
}
```

Create `services/api/src/llm/filesystem/files.controller.ts`:

```ts
import { Body, Controller, Post } from "@nestjs/common";
import { FilesystemService } from "./filesystem.service";

@Controller("api/files")
export class FilesController {
  constructor(private readonly files: FilesystemService) {}

  @Post("file-chat")
  fileChat(@Body() body: { input: string }) {
    return this.files.fileChat(body.input);
  }
}
```

Register in `advanced.module.ts`: add `FilesController`, `FilesystemService`, export `FilesystemService`.

- [ ] **Step 2: Curl acceptance for tools**

With API running from `services/api`:

```bash
curl -s -X POST http://localhost:3001/api/files/file-chat \
  -H "Content-Type: application/json" \
  -d '{"input":"查询订单 EC20240315001 的详情"}'

curl -s -X POST http://localhost:3001/api/files/file-chat \
  -H "Content-Type: application/json" \
  -d '{"input":"读取 policies/return-policy.md 的退货政策"}'

curl -s -X POST http://localhost:3001/api/files/file-chat \
  -H "Content-Type: application/json" \
  -d '{"input":"把以下内容写入 tickets/EC20240315001-analysis.md：订单 EC20240315001 的退货申请，商品为蓝牙耳机，未拆封，符合 7 天无理由退货条件，建议通过"}'

test -f services/api/workspace/tickets/EC20240315001-analysis.md && echo ticket-ok

curl -s -X POST http://localhost:3001/api/files/file-chat \
  -H "Content-Type: application/json" \
  -d '{"input":"把内容写入 ../../../etc/passwd"}'
```

Expected: order/policy answers succeed; ticket file exists; escape attempt surfaces「路径不允许逃逸工作目录」in tool error / model reply (must not write outside workspace).

- [ ] **Step 3: Commit**

```bash
git add services/api/src/llm/filesystem services/api/src/llm/advanced.module.ts
git commit -m "$(cat <<'EOF'
feat(api): add business file-chat tool loop endpoints

EOF
)"
```

---

### Task 5: Embedding + MemoryVectorStore + `/api/embedding`

**Files:**
- Create: `services/api/src/llm/embedding/embedding.service.ts`
- Create: `services/api/src/llm/embedding/vector-store.service.ts`
- Create: `services/api/src/llm/embedding/embedding.controller.ts`
- Modify: `services/api/src/llm/advanced.module.ts`

**Interfaces:**
- Produces `EmbeddingService`:
  - `embedQuery(text: string): Promise<number[]>`
  - `embedDocuments(documents: string[]): Promise<number[][]>`
- Produces `VectorStoreService`:
  - `addDocuments(docs: { content: string; metadata: Record<string, unknown> }[]): Promise<{ added: number }>`
  - `similaritySearch(query: string, topK: number): Promise<Array<{ content: string; metadata: Record<string, unknown> }>>`
- No auto-seed on startup

- [ ] **Step 1: Implement EmbeddingService**

Prefer community wrapper; if import/runtime fails, switch to xenova pipeline (same public methods).

Create `services/api/src/llm/embedding/embedding.service.ts` (xenova-direct fallback form — use this if community wrapper fails during Task 1 install validation):

```ts
import { Injectable, OnModuleInit } from "@nestjs/common";
import { pipeline } from "@xenova/transformers";

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private embedder: any;
  private ready = false;

  async onModuleInit() {
    this.embedder = await pipeline(
      "feature-extraction",
      "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
    );
    this.ready = true;
  }

  assertReady() {
    if (!this.ready) {
      throw new Error("Embedding model is not ready");
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    this.assertReady();
    const output = await this.embedder(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const doc of documents) {
      results.push(await this.embedQuery(doc));
    }
    return results;
  }
}
```

If `HuggingFaceTransformersEmbeddings` works with the installed `@langchain/community`, implement `EmbeddingService` by wrapping that class instead, still exposing `embedQuery` / `embedDocuments` and `assertReady()` (or equivalent readiness check).

- [ ] **Step 2: Implement VectorStoreService**

Create `services/api/src/llm/embedding/vector-store.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { Document } from "@langchain/core/documents";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { EmbeddingService } from "./embedding.service";

/** Minimal Embeddings adapter for MemoryVectorStore */
class NestEmbeddingsAdapter {
  constructor(private readonly embedding: EmbeddingService) {}
  embedQuery(text: string) {
    return this.embedding.embedQuery(text);
  }
  embedDocuments(documents: string[]) {
    return this.embedding.embedDocuments(documents);
  }
}

@Injectable()
export class VectorStoreService {
  private store: MemoryVectorStore | null = null;

  constructor(private readonly embedding: EmbeddingService) {}

  private getStore() {
    if (!this.store) {
      this.store = new MemoryVectorStore(
        new NestEmbeddingsAdapter(this.embedding) as any
      );
    }
    return this.store;
  }

  async addDocuments(
    docs: { content: string; metadata: Record<string, unknown> }[]
  ) {
    const documents = docs.map(
      (d) => new Document({ pageContent: d.content, metadata: d.metadata })
    );
    await this.getStore().addDocuments(documents);
    return { added: documents.length };
  }

  async similaritySearch(query: string, topK: number) {
    const results = await this.getStore().similaritySearch(query, topK);
    return results.map((doc) => ({
      content: doc.pageContent,
      metadata: doc.metadata as Record<string, unknown>,
    }));
  }
}
```

If `MemoryVectorStore` import path differs, fix import only; keep method signatures.

- [ ] **Step 3: Controller + module registration**

Create `services/api/src/llm/embedding/embedding.controller.ts`:

```ts
import { Body, Controller, Post } from "@nestjs/common";
import { VectorStoreService } from "./vector-store.service";

@Controller("api/embedding")
export class EmbeddingController {
  constructor(private readonly vectors: VectorStoreService) {}

  @Post("store")
  store(
    @Body()
    body: {
      documents: { content: string; metadata: Record<string, unknown> }[];
    }
  ) {
    return this.vectors.addDocuments(body.documents);
  }

  @Post("search")
  search(@Body() body: { query: string; topK?: number }) {
    return this.vectors.similaritySearch(body.query, body.topK ?? 3);
  }
}
```

Register `EmbeddingService`, `VectorStoreService`, `EmbeddingController` in `AdvancedModule`.

- [ ] **Step 4: Curl acceptance**

First request may download the model (slow). Then:

```bash
curl -s -X POST http://localhost:3001/api/embedding/store \
  -H "Content-Type: application/json" \
  -d '{"documents":[{"content":"7天无理由退货，商品需未拆封且不影响二次销售","metadata":{"source":"return-policy"}},{"content":"退款将在审核通过后3个工作日内原路退回","metadata":{"source":"refund-policy"}},{"content":"蓝牙耳机降噪问题属于质量投诉，可申请退货或换货","metadata":{"source":"faq"}}]}'

curl -s -X POST http://localhost:3001/api/embedding/search \
  -H "Content-Type: application/json" \
  -d '{"query":"蓝牙耳机未拆封能退货吗","topK":3}'
```

Expected: store → `{"added":3}`; search first hit metadata `source` is `return-policy` or `faq`.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/llm/embedding services/api/src/llm/advanced.module.ts
git commit -m "$(cat <<'EOF'
feat(api): add local embeddings and MemoryVectorStore endpoints

EOF
)"
```

---

### Task 6: Multi-Agent fixed workflow + `/api/agents`

**Files:**
- Create: `services/api/src/llm/agents/clarification.ts`
- Create: `services/api/src/llm/agents/sub-agents.ts`
- Create: `services/api/src/llm/agents/orchestrator.service.ts`
- Create: `services/api/src/llm/agents/agents.controller.ts`
- Create: `services/api/test/clarification.spec.ts`
- Modify: `services/api/src/llm/advanced.module.ts`

**Interfaces:**
- Produces:
  - `export type ExtractFields = { orderId: string | null; productId: string | null; requestType: string | null; receivedDate: string | null; isUnopened: boolean | null }`
  - `export function clarificationFromExtract(parsed: ExtractFields): string[]`
  - `export type OrchestrateResult = { mode: "fixed_workflow"; status?: "need_clarification"; clarificationQuestions: string[]; usedAgents: string[]; fallback: "ask_user" | "manual_review" | null; steps?: Record<string, string>; report?: string; error?: string; extract?: ExtractFields }`
  - `OrchestratorService.orchestrate(input: string): Promise<OrchestrateResult>`

- [ ] **Step 1: Write failing clarification test**

Create `services/api/test/clarification.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { clarificationFromExtract } from "../src/llm/agents/clarification";

describe("clarificationFromExtract", () => {
  test("asks for orderId and requestType when missing", () => {
    const questions = clarificationFromExtract({
      orderId: null,
      productId: null,
      requestType: null,
      receivedDate: null,
      isUnopened: null,
    });
    expect(questions).toContain("请提供订单号");
    expect(questions).toContain("请说明是退货、换货还是退款");
  });

  test("empty when required fields present", () => {
    const questions = clarificationFromExtract({
      orderId: "EC20240315001",
      productId: "headphone-x1",
      requestType: "退货",
      receivedDate: "2024-03-14",
      isUnopened: true,
    });
    expect(questions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/api && bun test test/clarification.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement clarification + sub-agents + orchestrator**

Create `services/api/src/llm/agents/clarification.ts`:

```ts
export type ExtractFields = {
  orderId: string | null;
  productId: string | null;
  requestType: string | null;
  receivedDate: string | null;
  isUnopened: boolean | null;
};

export function clarificationFromExtract(parsed: ExtractFields): string[] {
  const clarificationQuestions: string[] = [];
  if (!parsed.orderId) clarificationQuestions.push("请提供订单号");
  if (!parsed.requestType) {
    clarificationQuestions.push("请说明是退货、换货还是退款");
  }
  return clarificationQuestions;
}
```

Create `services/api/src/llm/agents/sub-agents.ts`:

```ts
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createChatModel } from "../model.factory";

const model = createChatModel();
const parser = new StringOutputParser();

export const extractAgent = ChatPromptTemplate.fromMessages([
  [
    "system",
    `你是需求抽取专家。从电商客服对话中提取以下字段并输出 JSON：
- orderId: 订单号
- productId: 商品 ID（如 headphone-x1）
- requestType: 退货 | 换货 | 退款
- receivedDate: 收货日期（YYYY-MM-DD）
- isUnopened: 是否未拆封（true/false）
如果某字段在对话中未提及，设为 null。只输出 JSON，不要 Markdown。`,
  ],
  ["human", "{input}"],
])
  .pipe(model)
  .pipe(parser);

export const policyCheckAgent = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是政策校验专家。根据标准退货政策（7 天无理由退货，商品需未拆封），判断下面的抽取结果是否符合退货条件，并给出原因。",
  ],
  ["human", "{extractResult}"],
])
  .pipe(model)
  .pipe(parser);

export const riskReviewAgent = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是风险审查专家。请识别下面抽取结果中的歧义、信息缺失或潜在冲突，列出风险点。",
  ],
  ["human", "{extractResult}"],
])
  .pipe(model)
  .pipe(parser);

export const qaAgent = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是 QA 专家。根据用户对话和抽取结果，生成 Given-When-Then 格式的验收条件，覆盖正常路径和边界情况。",
  ],
  ["human", "用户对话：\n{input}\n\n抽取结果：\n{extractResult}"],
])
  .pipe(model)
  .pipe(parser);

export const summaryAgent = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是汇总专家。整合所有 Agent 输出，生成最终的退货判断报告，包括结论、依据和下一步操作建议。",
  ],
  [
    "human",
    "抽取结果：\n{extractResult}\n\n政策校验：\n{policyResult}\n\n风险审查：\n{riskResult}\n\nQA 验收条件：\n{qaResult}",
  ],
])
  .pipe(model)
  .pipe(parser);
```

Create `services/api/src/llm/agents/orchestrator.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import {
  clarificationFromExtract,
  type ExtractFields,
} from "./clarification";
import {
  extractAgent,
  policyCheckAgent,
  qaAgent,
  riskReviewAgent,
  summaryAgent,
} from "./sub-agents";

export type OrchestrateResult = {
  mode: "fixed_workflow";
  status?: "need_clarification";
  clarificationQuestions: string[];
  usedAgents: string[];
  fallback: "ask_user" | "manual_review" | null;
  steps?: Record<string, string>;
  report?: string;
  error?: string;
  extract?: ExtractFields;
};

function parseExtractJson(raw: string): ExtractFields {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  const parsed = JSON.parse(trimmed);
  return {
    orderId: parsed.orderId ?? null,
    productId: parsed.productId ?? null,
    requestType: parsed.requestType ?? null,
    receivedDate: parsed.receivedDate ?? null,
    isUnopened:
      typeof parsed.isUnopened === "boolean" ? parsed.isUnopened : null,
  };
}

@Injectable()
export class OrchestratorService {
  async orchestrate(input: string): Promise<OrchestrateResult> {
    try {
      const extractResult = await extractAgent.invoke({ input });
      const parsed = parseExtractJson(extractResult);
      const clarificationQuestions = clarificationFromExtract(parsed);

      if (clarificationQuestions.length > 0) {
        return {
          mode: "fixed_workflow",
          status: "need_clarification",
          clarificationQuestions,
          usedAgents: ["RequirementExtractAgent"],
          fallback: "ask_user",
          extract: parsed,
        };
      }

      const [policyResult, riskResult] = await Promise.all([
        policyCheckAgent.invoke({ extractResult }),
        riskReviewAgent.invoke({ extractResult }),
      ]);
      const qaResult = await qaAgent.invoke({ input, extractResult });
      const report = await summaryAgent.invoke({
        extractResult,
        policyResult,
        riskResult,
        qaResult,
      });

      return {
        mode: "fixed_workflow",
        clarificationQuestions: [],
        usedAgents: [
          "RequirementExtractAgent",
          "PolicyCheckAgent",
          "RiskReviewAgent",
          "QAAgent",
          "SummaryAgent",
        ],
        fallback: null,
        steps: {
          extract: extractResult,
          policyCheck: policyResult,
          riskReview: riskResult,
          qa: qaResult,
        },
        report,
        extract: parsed,
      };
    } catch (error) {
      return {
        mode: "fixed_workflow",
        clarificationQuestions: [],
        usedAgents: ["RequirementExtractAgent"],
        fallback: "manual_review",
        report: "分析流程失败，请转人工复核。",
        error: String(error),
      };
    }
  }
}
```

Create `services/api/src/llm/agents/agents.controller.ts`:

```ts
import { Body, Controller, Post } from "@nestjs/common";
import { OrchestratorService } from "./orchestrator.service";

@Controller("api/agents")
export class AgentsController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  @Post("orchestrate")
  orchestrate(@Body() body: { input: string }) {
    return this.orchestrator.orchestrate(body.input);
  }
}
```

Register `OrchestratorService` + `AgentsController` in `AdvancedModule`; export `OrchestratorService`.

- [ ] **Step 4: Run unit tests**

```bash
cd services/api && bun test test/clarification.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Curl acceptance**

```bash
curl -s -X POST http://localhost:3001/api/agents/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"input":"我买的蓝牙耳机降噪效果不好，订单号 EC20240315001，昨天收到还没拆封，想退货"}'

curl -s -X POST http://localhost:3001/api/agents/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"input":"我想退货"}'
```

Expected A: `usedAgents` length 5, `fallback` null, `report` non-empty.  
Expected B: `status` = `need_clarification`, `clarificationQuestions` non-empty, `usedAgents` = `["RequirementExtractAgent"]`.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/llm/agents services/api/src/llm/advanced.module.ts services/api/test/clarification.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): add fixed-workflow multi-agent orchestrator

EOF
)"
```

---

### Task 7: Unified `analyze()` + `/api/advanced`

**Files:**
- Create: `services/api/src/llm/advanced-analysis.service.ts`
- Create: `services/api/src/llm/advanced.controller.ts`
- Create: `services/api/test/advanced-analysis.spec.ts`
- Modify: `services/api/src/llm/advanced.module.ts`

**Interfaces:**
- Consumes: `RunnableMemoryService`, `OrchestratorService`, `FilesystemService`
- Produces: `AdvancedAnalysisService.analyze(sessionId: string, input: string): Promise<OrchestrateResult>`

- [ ] **Step 1: Write failing analyze test (mocked deps)**

Create `services/api/test/advanced-analysis.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { AdvancedAnalysisService } from "../src/llm/advanced-analysis.service";

describe("AdvancedAnalysisService", () => {
  test("clarification path appends but does not write ticket", async () => {
    let wrote = false;
    let appended = false;

    const memory = {
      getHistory: async () => [],
      appendMessage: async () => {
        appended = true;
      },
    };
    const orchestrator = {
      orchestrate: async () => ({
        mode: "fixed_workflow" as const,
        status: "need_clarification" as const,
        clarificationQuestions: ["请提供订单号"],
        usedAgents: ["RequirementExtractAgent"],
        fallback: "ask_user" as const,
      }),
    };
    const files = {
      writeWorkspaceFile: async () => {
        wrote = true;
        return { success: true as const, path: "tickets/x.md" };
      },
    };

    const svc = new AdvancedAnalysisService(
      memory as any,
      orchestrator as any,
      files as any
    );
    const result = await svc.analyze("demo", "我想退货");

    expect(result.status).toBe("need_clarification");
    expect(wrote).toBe(false);
    expect(appended).toBe(true);
  });
});
```


- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/api && bun test test/advanced-analysis.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement analysis service + controller**

Create `services/api/src/llm/advanced-analysis.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { RunnableMemoryService } from "./memory/runnable-memory.service";
import { OrchestratorService } from "./agents/orchestrator.service";
import { FilesystemService } from "./filesystem/filesystem.service";

@Injectable()
export class AdvancedAnalysisService {
  constructor(
    private readonly memory: RunnableMemoryService,
    private readonly orchestrator: OrchestratorService,
    private readonly files: FilesystemService
  ) {}

  async analyze(sessionId: string, input: string) {
    const history = await this.memory.getHistory(sessionId);
    const enrichedInput = [
      history.length ? `历史上下文：${JSON.stringify(history)}` : "",
      `当前输入：${input}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await this.orchestrator.orchestrate(enrichedInput);

    const needsClarification =
      (result.clarificationQuestions?.length ?? 0) > 0 ||
      result.status === "need_clarification";

    if (!needsClarification && result.report) {
      const orderId = result.extract?.orderId ?? "EC20240315001";
      await this.files.writeWorkspaceFile(
        `tickets/${orderId}-analysis.md`,
        result.report
      );
    }

    const aiContent = needsClarification
      ? `需要补充信息：${(result.clarificationQuestions ?? []).join("；")}`
      : (result.report ?? "分析完成");

    await this.memory.appendMessage(sessionId, input, aiContent);
    return result;
  }
}
```

Create `services/api/src/llm/advanced.controller.ts`:

```ts
import { Body, Controller, Post } from "@nestjs/common";
import { AdvancedAnalysisService } from "./advanced-analysis.service";

@Controller("api/advanced")
export class AdvancedController {
  constructor(private readonly analysis: AdvancedAnalysisService) {}

  @Post("analyze")
  analyze(@Body() body: { sessionId: string; input: string }) {
    return this.analysis.analyze(body.sessionId, body.input);
  }
}
```

Final `advanced.module.ts` must register all controllers/providers from Tasks 3–7 and export services needed by `AdvancedAnalysisService`.

- [ ] **Step 4: Run unit tests**

```bash
cd services/api && bun test test/advanced-analysis.spec.ts test/clarification.spec.ts test/business.tools.spec.ts test/memory.service.spec.ts
```

Expected: all PASS.

- [ ] **Step 5: Curl acceptance for analyze**

```bash
curl -s -X POST http://localhost:3001/api/advanced/analyze \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"demo","input":"我买的蓝牙耳机降噪效果不好，想退货"}'

curl -s -X POST http://localhost:3001/api/advanced/analyze \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"demo","input":"订单号是 EC20240315001"}'

curl -s -X POST http://localhost:3001/api/advanced/analyze \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"demo","input":"我是昨天收到的，还没拆封"}'

curl -s -X POST http://localhost:3001/api/advanced/analyze \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"demo","input":"帮我判断一下能不能退，如果可以请告诉我下一步操作"}'

test -f services/api/workspace/tickets/EC20240315001-analysis.md && echo analyze-ticket-ok
curl -s "http://localhost:3001/api/memory/history?sessionId=demo"
```

Expected: round 4 returns full `report`; ticket file exists; last AI history message is report/conclusion text (from `appendMessage`, not a fresh chat rewrite).

- [ ] **Step 6: Commit**

```bash
git add services/api/src/llm/advanced-analysis.service.ts services/api/src/llm/advanced.controller.ts services/api/src/llm/advanced.module.ts services/api/test/advanced-analysis.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): unify Ch4 analyze entry with memory and tickets

EOF
)"
```

---

### Task 8: Full chapter acceptance checklist + learning-path note

**Files:**
- Modify (optional): `docs/learning-path.md` — mark 第四章 checkbox only if all acceptance below passes

- [ ] **Step 1: Run automated tests**

```bash
cd services/api && bun test
```

Expected: existing Ch3 tests + new Ch4 unit tests PASS (LLM-skipping tests remain skipped without key).

- [ ] **Step 2: Run full curl matrix (base `http://localhost:3001`)**

Checklist:

1. Memory four-turn + history 8 messages + clear
2. Files: query order / read policy / write ticket / escape rejected
3. Embedding store + search relevance
4. Agents complete vs clarification
5. Analyze four-turn + ticket + history last AI = appended conclusion

- [ ] **Step 3: Optional learning-path update**

If all pass, in `docs/learning-path.md` check 第四章 and set「当前下一步」to 第五章. Commit separately:

```bash
git add docs/learning-path.md
git commit -m "$(cat <<'EOF'
docs: mark Ch4 complete on learning path

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Memory + trim + `/api/memory` | Task 3 |
| Business tools + safePath + `/api/files` | Tasks 2, 4 |
| Embedding + MemoryVectorStore + `/api/embedding` | Task 5 |
| 5-agent fixed workflow + clarification | Task 6 |
| `analyze()` Memory→Orchestrator→ticket→append | Task 7 |
| Workspace seeds | Task 1 |
| No frontend / no pgvector / no Tools inside analyze | Global Constraints + Task 7 |
| Port 3001 acceptance | Tasks 3–8 |
| Unit tests: safePath, clarification, analyze skip write | Tasks 2, 6, 7 |

Placeholder scan: none intentional. Import paths for LangChain v1 may need one-line fixes at implement time; public Nest/service APIs in this plan stay stable.
