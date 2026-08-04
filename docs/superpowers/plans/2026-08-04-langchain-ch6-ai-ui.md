# LangChain Ch6 AI-Driven UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `services/chat` 落地 LLM 主导的 UI 协议（`/api/ui-chat`）与分析 SSE，并在 `clients/chat-web` 渲染可交互组件闭环。

**Architecture:** 独立 `UiProtocolModule`：Zod + `withStructuredOutput` 生成 `AIUIResponse`；`UIAction` 回传合并 `collectedData`；`confirm=true` 仅返回 `streamSuggested`；`analyze/stream` 调用现有 `orchestrate` 经 Adapter 映射 UI；前端按 `type` 渲染。不改 Prisma schema、不改 llm-core 内核、不改纯文本 chat。

**Tech Stack:** Bun, NestJS 11, Zod 3, `@autix/llm-core` (`createChatModel` / `orchestrate`), Prisma Message.metadata, Next.js 16 (chat-web), bun:test

**Spec:** `docs/superpowers/specs/2026-08-04-langchain-ch6-ai-ui-design.md`

## Scope note

Spec 覆盖协议 + 同步 API + SSE + 前端。按 brainstorming「整章一次」用 **一个计划、顺序 Task** 交付。每个 Task 结束有独立可测点。若压力过大，可在 Task 6（同步 API）后开 PR，再继续 SSE/前端。

## Global Constraints

- Branch: `feat/LangChain-Advanced-UI`
- Spec: `docs/superpowers/specs/2026-08-04-langchain-ch6-ai-ui-design.md`
- Reference: https://github.com/Cookieboty/autix-demo/tree/feat/ai-ui（协议/组件；**不**照搬主路径状态机）
- Chat port: `PORT ?? 4001`；chat-web: `3002`
- Auth: JWT required on all `/api/ui-chat/*`; cross-user conversation → **404**
- `conversationId` = `Conversation.id`
- Persistence: Message `content` + `metadata` only; **no** Prisma migrate
- Flow: LLM Structured Output 主导；`confirm=true` → `streamSuggested: true`，**不**调 orchestrate
- Only `POST .../analyze/stream` calls `orchestrate`
- Streaming: progress may be placeholder; ui components always batched whole
- Keep `POST /api/conversations/:id/chat` and `/api/sse` unchanged
- Do not rewrite Multi-Agent into「需求分析」agents
- Tests: `bun test` in `services/chat`
- Add `zod` dependency to `@autix/chat` (not currently present)

---

## File Structure (locked)

| Path | Responsibility |
|------|----------------|
| `services/chat/src/llm/ui-protocol/ui-types.ts` | UIResponse / AIUIResponse / UIAction / StreamMessage types |
| `services/chat/src/llm/ui-protocol/ui-schemas.ts` | Zod schemas + `aiUIResponseSchema` |
| `services/chat/src/llm/ui-protocol/ui-validate.ts` | `validateUIResponse` post-process |
| `services/chat/src/llm/ui-protocol/ui-persistence.ts` | load/merge context; persist human/ai UI messages |
| `services/chat/src/llm/ui-protocol/ui-orchestrate.adapter.ts` | `mapOrchestrateToUI` + build orchestrate input |
| `services/chat/src/llm/ui-protocol/ui-response.service.ts` | Structured Output generation |
| `services/chat/src/llm/ui-protocol/ui-action.service.ts` | Handle UIAction; streamSuggested on confirm |
| `services/chat/src/llm/ui-protocol/ui-chat.controller.ts` | HTTP + SSE endpoints |
| `services/chat/src/llm/ui-protocol/ui-chat.module.ts` | Nest module |
| `services/chat/test/ui-schemas.spec.ts` | Schema + validate tests |
| `services/chat/test/ui-orchestrate.adapter.spec.ts` | Adapter mapping tests |
| `services/chat/test/ui-action.service.spec.ts` | confirm → streamSuggested tests |
| `clients/chat-web/types/ui-types.ts` | Shared frontend types (mirror backend) |
| `clients/chat-web/components/ai-ui/*` | ComponentRenderer + widgets |
| `clients/chat-web/components/ai-ui/AIChatContainer.tsx` | Chat UX + JWT + SSE |
| `clients/chat-web/app/page.tsx` | Mount AI chat UI |
| `clients/chat-web/.env.example` | `NEXT_PUBLIC_API_BASE_URL` |

---

### Task 1: UI protocol types, Zod schemas, and validateUIResponse

**Files:**
- Modify: `services/chat/package.json` (add `"zod": "^3.23.8"`)
- Create: `services/chat/src/llm/ui-protocol/ui-types.ts`
- Create: `services/chat/src/llm/ui-protocol/ui-schemas.ts`
- Create: `services/chat/src/llm/ui-protocol/ui-validate.ts`
- Test: `services/chat/test/ui-schemas.spec.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - Types: `UIResponse`, `AIUIResponse`, `UIAction`, `StreamMessage`, `AIUIResponseWithStreamHint`
  - `aiUIResponseSchema` (Zod)
  - `validateUIResponse(response: AIUIResponse): AIUIResponse`

- [ ] **Step 1: Add zod dependency**

In `services/chat/package.json` dependencies add:

```json
"zod": "^3.23.8"
```

Run from repo root:

```bash
bun install
```

Expected: lockfile updates; no errors.

- [ ] **Step 2: Write the failing test**

Create `services/chat/test/ui-schemas.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { aiUIResponseSchema } from "../src/llm/ui-protocol/ui-schemas";
import { validateUIResponse } from "../src/llm/ui-protocol/ui-validate";
import type { AIUIResponse } from "../src/llm/ui-protocol/ui-types";

describe("aiUIResponseSchema", () => {
  test("parses a selection response", () => {
    const parsed = aiUIResponseSchema.parse({
      version: "1.0",
      message: "请选择需求类型",
      components: [
        {
          type: "selection",
          title: "需求类型",
          options: [
            { id: "functional", label: "功能需求" },
            { id: "performance", label: "性能需求" },
          ],
        },
      ],
    });
    expect(parsed.components[0]?.type).toBe("selection");
  });

  test("rejects selection with fewer than 2 options", () => {
    expect(() =>
      aiUIResponseSchema.parse({
        version: "1.0",
        message: "x",
        components: [
          {
            type: "selection",
            title: "t",
            options: [{ id: "a", label: "A" }],
          },
        ],
      }),
    ).toThrow();
  });
});

describe("validateUIResponse", () => {
  test("fills empty message and drops invalid selection", () => {
    const input = {
      version: "1.0" as const,
      message: "   ",
      components: [
        {
          type: "selection" as const,
          title: "t",
          options: [{ id: "a", label: "A" }],
        },
        {
          type: "text" as const,
          content: "hello",
        },
      ],
    } satisfies AIUIResponse;

    const result = validateUIResponse(input);
    expect(result.message).toBe("正在为您处理...");
    expect(result.components).toEqual([{ type: "text", content: "hello" }]);
  });

  test("truncates components to 5", () => {
    const components = Array.from({ length: 7 }, (_, i) => ({
      type: "text" as const,
      content: `c${i}`,
    }));
    const result = validateUIResponse({
      version: "1.0",
      message: "ok",
      components,
    });
    expect(result.components).toHaveLength(5);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd services/chat && bun test test/ui-schemas.spec.ts
```

Expected: FAIL (module not found / cannot find package zod schemas).

- [ ] **Step 4: Implement types**

Create `services/chat/src/llm/ui-protocol/ui-types.ts` with the full protocol from the spec (all component interfaces, `UIResponse` union, `AIUIResponse` with `version: '1.0'`, `UIAction`, `StreamMessage`, and):

```ts
export type AIUIResponseWithStreamHint = AIUIResponse & {
  streamSuggested?: boolean;
};
```

Mirror field shapes from https://raw.githubusercontent.com/Cookieboty/autix-demo/feat/ai-ui/services/chat/src/llm/ui-protocol/ui-types.ts and add `version` + `StreamMessage` as in the spec.

- [ ] **Step 5: Implement schemas**

Create `services/chat/src/llm/ui-protocol/ui-schemas.ts` aligned with feat/ai-ui Zod (discriminatedUnion on `type`), plus:

```ts
export const aiUIResponseSchema = z.object({
  version: z.literal("1.0").default("1.0"),
  message: z.string(),
  components: z.array(uiComponentSchema),
  context: z
    .object({
      sessionStage: z.string().nullable().optional(),
      collectedData: z.record(z.unknown()).nullable().optional(),
    })
    .nullable()
    .optional(),
});
```

Use nullable optionals where feat/ai-ui does, so Structured Output is less brittle.

- [ ] **Step 6: Implement validateUIResponse**

Create `services/chat/src/llm/ui-protocol/ui-validate.ts`:

```ts
import type { AIUIResponse, UIResponse } from "./ui-types";

export function validateUIResponse(response: AIUIResponse): AIUIResponse {
  const message = response.message?.trim()
    ? response.message
    : "正在为您处理...";

  let components = (response.components ?? []).filter((comp: UIResponse) => {
    if (comp.type === "selection" && comp.options.length < 2) return false;
    if (comp.type === "form" && comp.fields.length === 0) return false;
    return true;
  });

  if (components.length > 5) {
    components = components.slice(0, 5);
  }

  return {
    ...response,
    version: "1.0",
    message,
    components,
  };
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd services/chat && bun test test/ui-schemas.spec.ts
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add services/chat/package.json bun.lock services/chat/src/llm/ui-protocol/ui-types.ts services/chat/src/llm/ui-protocol/ui-schemas.ts services/chat/src/llm/ui-protocol/ui-validate.ts services/chat/test/ui-schemas.spec.ts
git commit -m "feat(chat): add AI UI protocol types, schemas, and validation"
```

---

### Task 2: UIOrchestrateAdapter mapping (pure)

**Files:**
- Create: `services/chat/src/llm/ui-protocol/ui-orchestrate.adapter.ts`
- Test: `services/chat/test/ui-orchestrate.adapter.spec.ts`

**Interfaces:**
- Consumes: `OrchestrateResult` from `@autix/llm-core`; `AIUIResponse` types
- Produces:
  - `buildOrchestrateInput(collectedData: Record<string, unknown>, recentText: string): string`
  - `mapOrchestrateToUI(result: OrchestrateResult, collectedData?: Record<string, unknown>): AIUIResponse`
  - `class UIOrchestrateAdapter { analyze(collectedData, recentText): Promise<AIUIResponse> }` using injected/imported `orchestrate`

- [ ] **Step 1: Write the failing test**

Create `services/chat/test/ui-orchestrate.adapter.spec.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { OrchestrateResult } from "@autix/llm-core";
import {
  buildOrchestrateInput,
  mapOrchestrateToUI,
} from "../src/llm/ui-protocol/ui-orchestrate.adapter";

describe("buildOrchestrateInput", () => {
  test("includes collected fields and recent text", () => {
    const text = buildOrchestrateInput(
      { title: "批量导入 Excel", reqType: "functional", priority: "P1" },
      "用户确认提交分析",
    );
    expect(text).toContain("批量导入 Excel");
    expect(text).toContain("functional");
    expect(text).toContain("用户确认提交分析");
  });
});

describe("mapOrchestrateToUI", () => {
  test("maps need_clarification to selection", () => {
    const result: OrchestrateResult = {
      mode: "fixed_workflow",
      status: "need_clarification",
      clarificationQuestions: ["订单号是多少？", "是否未开封？"],
      usedAgents: ["extractAgent"],
      fallback: "ask_user",
    };
    const ui = mapOrchestrateToUI(result);
    expect(ui.components[0]?.type).toBe("selection");
    if (ui.components[0]?.type === "selection") {
      expect(ui.components[0].options.length).toBe(2);
    }
  });

  test("maps report to steps + card + action_buttons", () => {
    const result: OrchestrateResult = {
      mode: "fixed_workflow",
      clarificationQuestions: [],
      usedAgents: ["extractAgent", "policyCheckAgent", "summaryAgent"],
      fallback: null,
      report: "## 分析报告\n可以退款",
      steps: { extract: "ok", policy: "ok", summary: "ok" },
    };
    const ui = mapOrchestrateToUI(result, { title: "退款申请" });
    const types = ui.components.map((c) => c.type);
    expect(types).toContain("steps");
    expect(types).toContain("card");
    expect(types).toContain("action_buttons");
    expect(ui.message).toContain("分析报告");
  });

  test("maps error to text + retry button", () => {
    const result: OrchestrateResult = {
      mode: "fixed_workflow",
      clarificationQuestions: [],
      usedAgents: [],
      fallback: "manual_review",
      error: "模型调用失败",
    };
    const ui = mapOrchestrateToUI(result);
    expect(ui.components.some((c) => c.type === "text")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/chat && bun test test/ui-orchestrate.adapter.spec.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement adapter**

Create `services/chat/src/llm/ui-protocol/ui-orchestrate.adapter.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { orchestrate, type OrchestrateResult } from "@autix/llm-core";
import type { AIUIResponse, UIResponse } from "./ui-types";
import { validateUIResponse } from "./ui-validate";

export function buildOrchestrateInput(
  collectedData: Record<string, unknown>,
  recentText: string,
): string {
  return [
    "请根据以下已收集的需求/业务上下文进行分析：",
    JSON.stringify(collectedData, null, 2),
    recentText ? `补充说明：\n${recentText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function mapOrchestrateToUI(
  result: OrchestrateResult,
  collectedData: Record<string, unknown> = {},
): AIUIResponse {
  if (result.status === "need_clarification") {
    const options = result.clarificationQuestions.map((q, i) => ({
      id: `clarify_${i}`,
      label: q,
      description: "请选择或稍后在输入框补充",
    }));
    // selection schema requires >= 2; pad if needed
    while (options.length < 2) {
      options.push({
        id: `clarify_extra_${options.length}`,
        label: "其他（请在输入框说明）",
        description: "",
      });
    }
    return validateUIResponse({
      version: "1.0",
      message: "还需要补充以下信息才能继续分析：",
      components: [
        {
          type: "selection",
          title: "待澄清问题",
          options,
          allowMultiple: false,
        },
      ],
      context: { sessionStage: "clarify", collectedData },
    });
  }

  if (result.error) {
    return validateUIResponse({
      version: "1.0",
      message: result.error,
      components: [
        { type: "text", content: result.error },
        {
          type: "action_buttons",
          title: "后续操作",
          buttons: [{ id: "retry_analyze", label: "重试分析", variant: "primary" }],
          layout: "horizontal",
        },
      ],
      context: { sessionStage: "error", collectedData },
    });
  }

  const agentSteps = (result.usedAgents?.length
    ? result.usedAgents
    : Object.keys(result.steps ?? {})
  ).map((label, index, arr) => ({
    label,
    status: (index === arr.length - 1 ? "current" : "completed") as
      | "current"
      | "completed",
  }));

  const components: UIResponse[] = [
    {
      type: "steps",
      currentStep: Math.max(agentSteps.length - 1, 0),
      steps:
        agentSteps.length > 0
          ? agentSteps
          : [{ label: "汇总报告", status: "current" }],
    },
    {
      type: "card",
      title: String(collectedData.title ?? "分析结果"),
      subtitle: String(collectedData.reqType ?? ""),
      fields: [
        {
          label: "状态",
          value: result.fallback ? String(result.fallback) : "已完成",
          type: "status",
        },
        {
          label: "使用 Agent",
          value: (result.usedAgents ?? []).join(", ") || "n/a",
          type: "text",
        },
      ],
    },
    {
      type: "action_buttons",
      title: "后续操作",
      buttons: [
        { id: "view_report", label: "查看报告要点", variant: "primary" },
        { id: "new_req", label: "继续提问", variant: "secondary" },
      ],
      layout: "horizontal",
    },
  ];

  return validateUIResponse({
    version: "1.0",
    message: result.report ?? "分析完成",
    components,
    context: { sessionStage: "result", collectedData },
  });
}

@Injectable()
export class UIOrchestrateAdapter {
  async analyze(
    collectedData: Record<string, unknown>,
    recentText: string,
  ): Promise<AIUIResponse> {
    const input = buildOrchestrateInput(collectedData, recentText);
    const result = await orchestrate(input);
    return mapOrchestrateToUI(result, collectedData);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd services/chat && bun test test/ui-orchestrate.adapter.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/chat/src/llm/ui-protocol/ui-orchestrate.adapter.ts services/chat/test/ui-orchestrate.adapter.spec.ts
git commit -m "feat(chat): map orchestrate results to AI UI responses"
```

---

### Task 3: UI persistence helpers

**Files:**
- Create: `services/chat/src/llm/ui-protocol/ui-persistence.ts`
- Test: `services/chat/test/ui-persistence.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `AIUIResponse`, `UIAction`
- Produces:
  - `extractCollectedData(messages: { role: string; metadata: unknown }[]): Record<string, unknown>`
  - `formatActionContent(action: UIAction): string`
  - helpers used by services to persist via `DatabaseChatMessageHistory` or prisma directly

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import {
  extractCollectedData,
  formatActionContent,
} from "../src/llm/ui-protocol/ui-persistence";

describe("extractCollectedData", () => {
  test("reads context from latest ai metadata.ui", () => {
    const data = extractCollectedData([
      {
        role: "ai",
        metadata: {
          ui: {
            version: "1.0",
            message: "ok",
            components: [],
            context: { collectedData: { title: "旧" } },
          },
        },
      },
      {
        role: "ai",
        metadata: {
          ui: {
            version: "1.0",
            message: "ok",
            components: [],
            context: { collectedData: { title: "新", priority: "P1" } },
          },
        },
      },
    ]);
    expect(data).toEqual({ title: "新", priority: "P1" });
  });
});

describe("formatActionContent", () => {
  test("formats select action", () => {
    expect(
      formatActionContent({
        componentType: "selection",
        payload: { type: "select", selectedId: "functional" },
      }),
    ).toBe("[UI 操作: selection → select]");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd services/chat && bun test test/ui-persistence.spec.ts
```

- [ ] **Step 3: Implement**

```ts
import type { UIAction, AIUIResponse } from "./ui-types";

export function formatActionContent(action: UIAction): string {
  return `[UI 操作: ${action.componentType} → ${action.payload.type}]`;
}

export function extractCollectedData(
  messages: Array<{ role: string; metadata: unknown }>,
): Record<string, unknown> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (row.role !== "ai") continue;
    const meta = row.metadata as
      | { ui?: AIUIResponse }
      | null
      | undefined;
    const collected = meta?.ui?.context?.collectedData;
    if (collected && typeof collected === "object") {
      return { ...collected };
    }
  }
  return {};
}

export function mergeCollectedData(
  base: Record<string, unknown>,
  action: UIAction,
): Record<string, unknown> {
  const next = { ...base };
  const p = action.payload;
  if (p.type === "select") {
    next.lastSelectedId = p.selectedId;
    if (typeof p.selectedId === "string" && !next.reqType) {
      next.reqType = p.selectedId;
    }
  } else if (p.type === "submit") {
    Object.assign(next, p.formData);
  } else if (p.type === "confirm") {
    next.lastConfirmed = p.confirmed;
  } else if (p.type === "click") {
    next.lastActionId = p.actionId;
  } else if (p.type === "row_select") {
    next.lastRowIndex = p.rowIndex;
  }
  return next;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd services/chat && bun test test/ui-persistence.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add services/chat/src/llm/ui-protocol/ui-persistence.ts services/chat/test/ui-persistence.spec.ts
git commit -m "feat(chat): add UI chat persistence helpers for collectedData"
```

---

### Task 4: UIResponseService (Structured Output + fallback)

**Files:**
- Create: `services/chat/src/llm/ui-protocol/ui-response.service.ts`
- Test: `services/chat/test/ui-response.fallback.spec.ts` (unit-test fallback path with injectable runner)

**Interfaces:**
- Consumes: `createChatModel` from `@autix/llm-core`, `aiUIResponseSchema`, `validateUIResponse`
- Produces:
  - `UIResponseService.generateUIResponse(input: string, historyTexts: string[], collectedData: Record<string, unknown>): Promise<AIUIResponse>`

- [ ] **Step 1: Write failing test for fallback helper**

Export a small pure helper used when LLM fails:

```ts
// in ui-response.service.ts
export function buildFallbackUIResponse(reason: string): AIUIResponse {
  return validateUIResponse({
    version: "1.0",
    message: "暂时无法生成交互组件，请用文字继续描述。",
    components: [{ type: "text", content: reason || "structured output failed" }],
  });
}
```

Test:

```ts
import { describe, expect, test } from "bun:test";
import { buildFallbackUIResponse } from "../src/llm/ui-protocol/ui-response.service";

describe("buildFallbackUIResponse", () => {
  test("returns text component", () => {
    const ui = buildFallbackUIResponse("boom");
    expect(ui.version).toBe("1.0");
    expect(ui.components[0]?.type).toBe("text");
  });
});
```

- [ ] **Step 2: Run — expect FAIL, then implement service**

Implement `UIResponseService`:

```ts
import { Injectable, Logger } from "@nestjs/common";
import { createChatModel } from "@autix/llm-core";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { aiUIResponseSchema } from "./ui-schemas";
import type { AIUIResponse } from "./ui-types";
import { validateUIResponse } from "./ui-validate";

const UI_SYSTEM_PROMPT = `你是一名需求分析助手。你的回复必须是结构化 UI（message + components）。
组件选择：selection（明确选项）、form（多字段）、confirmation（重要确认）、card（详情）、steps/table/action_buttons/text。
组合规则：message 必填；components 可多个。
context.sessionStage 与 collectedData 要反映当前进度。
version 固定为 "1.0"。`;

export function buildFallbackUIResponse(reason: string): AIUIResponse {
  return validateUIResponse({
    version: "1.0",
    message: "暂时无法生成交互组件，请用文字继续描述。",
    components: [
      { type: "text", content: reason || "structured output failed" },
    ],
  });
}

@Injectable()
export class UIResponseService {
  private readonly logger = new Logger(UIResponseService.name);

  async generateUIResponse(
    input: string,
    history: BaseMessage[] = [],
    collectedData: Record<string, unknown> = {},
  ): Promise<AIUIResponse> {
    try {
      const model = createChatModel({ maxTokens: 2000 });
      const structured = model.withStructuredOutput(aiUIResponseSchema);
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", UI_SYSTEM_PROMPT],
        new MessagesPlaceholder("history"),
        ["human", "{input}"],
      ]);
      const enriched = `${input}\n\n[collectedData] ${JSON.stringify(collectedData)}`;
      const raw = (await prompt.pipe(structured).invoke({
        input: enriched,
        history,
      })) as AIUIResponse;
      return validateUIResponse({ ...raw, version: "1.0" });
    } catch (err) {
      this.logger.error(
        `structured generation failed: ${err instanceof Error ? err.name : "unknown"}`,
      );
      return buildFallbackUIResponse(
        err instanceof Error ? err.message : "unknown error",
      );
    }
  }

  toLangChainHistory(
    rows: Array<{ role: string; content: string }>,
  ): BaseMessage[] {
    return rows.map((row) =>
      row.role === "human"
        ? new HumanMessage(row.content)
        : new AIMessage(row.content),
    );
  }
}
```

Note: chat may need `@langchain/core` prompts already present. If `MessagesPlaceholder` import path differs in installed version, match existing api/chat usage.

- [ ] **Step 3: Run unit test PASS**

```bash
cd services/chat && bun test test/ui-response.fallback.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add services/chat/src/llm/ui-protocol/ui-response.service.ts services/chat/test/ui-response.fallback.spec.ts
git commit -m "feat(chat): add UIResponseService with structured output fallback"
```

---

### Task 5: UIActionService (confirm → streamSuggested)

**Files:**
- Create: `services/chat/src/llm/ui-protocol/ui-action.service.ts`
- Test: `services/chat/test/ui-action.service.spec.ts`

**Interfaces:**
- Consumes: `UIResponseService`, persistence helpers, `ConversationService` / prisma
- Produces:
  - `UIActionService.handleAction(userId, conversationId, action): Promise<AIUIResponseWithStreamHint>`
  - `UIChatFacade.chat(...)` can live here or in a thin `UIChatService` — **lock:** create `ui-chat.service.ts` that owns chat + action orchestration with DB.

Prefer one facade service for controller thinness:

- Create also: `services/chat/src/llm/ui-protocol/ui-chat.service.ts`

**Produces:**
- `UIChatService.chat(userId, conversationId, input): Promise<AIUIResponse>`
- `UIChatService.action(userId, conversationId, action): Promise<AIUIResponseWithStreamHint>`
- `UIChatService.analyzeStream(userId, conversationId): AsyncGenerator<StreamMessage>` (stub throw in this task; implemented Task 7)

- [ ] **Step 1: Write failing tests for confirm branch (pure decision + merge)**

```ts
import { describe, expect, test } from "bun:test";
import { mergeCollectedData } from "../src/llm/ui-protocol/ui-persistence";
import type { UIAction } from "../src/llm/ui-protocol/ui-types";

describe("confirm action contract", () => {
  test("mergeCollectedData stores lastConfirmed", () => {
    const action: UIAction = {
      componentType: "confirmation",
      payload: { type: "confirm", confirmed: true },
    };
    expect(mergeCollectedData({}, action).lastConfirmed).toBe(true);
  });
});
```

(Full service test with mocks:)

```ts
import { describe, expect, test, mock } from "bun:test";
// After UIChatService exists — mock conversations + responseService
```

Implement `UIChatService` with constructor injection; in test, pass mocks:

```ts
test("action confirm=true returns streamSuggested and does not call generateUIResponse", async () => {
  const generateUIResponse = mock(async () => {
    throw new Error("should not be called");
  });
  const service = new UIChatService(
    /* prisma/conversations mocks that record persists */,
    { generateUIResponse, toLangChainHistory: () => [] } as any,
    { analyze: mock(async () => { throw new Error("no orchestrate"); }) } as any,
  );
  // setup getOwnedOrThrow + message list mocks...
  const result = await service.action("u1", "c1", {
    componentType: "confirmation",
    payload: { type: "confirm", confirmed: true },
  });
  expect(result.streamSuggested).toBe(true);
  expect(generateUIResponse).not.toHaveBeenCalled();
});
```

Keep mocks minimal: extract `isConfirmAnalyze(action: UIAction): boolean` pure function and test that + document service behavior in code comments if Nest mocking is heavy. **Minimum required:** pure `isConfirmAnalyze` test + implement service correctly for Task 6 manual/integration check.

```ts
export function isConfirmAnalyze(action: UIAction): boolean {
  return action.payload.type === "confirm" && action.payload.confirmed === true;
}
```

- [ ] **Step 2: Implement `ui-chat.service.ts`**

Sketch:

```ts
@Injectable()
export class UIChatService {
  constructor(
    private readonly conversations: ConversationService,
    private readonly prisma: PrismaService,
    private readonly uiResponse: UIResponseService,
    private readonly orchestrateAdapter: UIOrchestrateAdapter,
  ) {}

  async chat(userId: string, conversationId: string, input: string): Promise<AIUIResponse> {
    if (!input?.trim()) throw new BadRequestException("Input is required");
    await this.conversations.getOwnedOrThrow(userId, conversationId);
    const rows = await this.prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
    const collected = extractCollectedData(rows);
    const history = this.uiResponse.toLangChainHistory(rows);
    const historyDb = new DatabaseChatMessageHistory(this.prisma, conversationId);
    await historyDb.addMessage("human", input);
    const ui = await this.uiResponse.generateUIResponse(input, history, collected);
    const withCtx: AIUIResponse = {
      ...ui,
      context: {
        sessionStage: ui.context?.sessionStage,
        collectedData: { ...collected, ...(ui.context?.collectedData ?? {}) },
      },
    };
    await historyDb.addMessage("ai", withCtx.message, { ui: withCtx });
    return withCtx;
  }

  async action(userId: string, conversationId: string, action: UIAction): Promise<AIUIResponseWithStreamHint> {
    await this.conversations.getOwnedOrThrow(userId, conversationId);
    const rows = await this.prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
    const collected = mergeCollectedData(extractCollectedData(rows), action);
    const historyDb = new DatabaseChatMessageHistory(this.prisma, conversationId);
    await historyDb.addMessage("human", formatActionContent(action), { action });

    if (isConfirmAnalyze(action)) {
      const ui: AIUIResponse = validateUIResponse({
        version: "1.0",
        message: "已确认，开始分析…",
        components: [
          {
            type: "steps",
            currentStep: 0,
            steps: [
              { label: "准备分析", status: "current" },
              { label: "多智能体处理", status: "pending" },
              { label: "汇总报告", status: "pending" },
            ],
          },
        ],
        context: { sessionStage: "analyzing", collectedData: collected },
      });
      await historyDb.addMessage("ai", ui.message, { ui });
      return { ...ui, streamSuggested: true };
    }

    const prompt = `用户 UI 操作：${JSON.stringify(action)}\n请给出下一步 UI。`;
    const history = this.uiResponse.toLangChainHistory(
      await this.prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } }),
    );
    const ui = await this.uiResponse.generateUIResponse(prompt, history, collected);
    const withCtx = {
      ...ui,
      context: {
        sessionStage: ui.context?.sessionStage,
        collectedData: { ...collected, ...(ui.context?.collectedData ?? {}) },
      },
    };
    await historyDb.addMessage("ai", withCtx.message, { ui: withCtx });
    return withCtx;
  }
}
```

- [ ] **Step 3: Test `isConfirmAnalyze` PASS + typecheck service compiles**

```bash
cd services/chat && bun test test/ui-action.service.spec.ts
cd services/chat && bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add services/chat/src/llm/ui-protocol/ui-chat.service.ts services/chat/src/llm/ui-protocol/ui-action.service.ts services/chat/test/ui-action.service.spec.ts
git commit -m "feat(chat): add UIChatService chat/action with streamSuggested confirm"
```

If `ui-action.service.ts` is unused (logic folded into UIChatService), **do not create empty file** — only `ui-chat.service.ts` + export `isConfirmAnalyze` from it or `ui-persistence.ts`.

**Lock:** put `isConfirmAnalyze` in `ui-persistence.ts`; single `ui-chat.service.ts` (no separate empty action service).

---

### Task 6: UIChatController + Module wiring (sync endpoints)

**Files:**
- Create: `services/chat/src/llm/ui-protocol/ui-chat.controller.ts`
- Create: `services/chat/src/llm/ui-protocol/ui-chat.module.ts`
- Modify: `services/chat/src/app.module.ts` — import `UiChatModule`
- Modify: `services/chat/src/conversation/conversation.module.ts` — export `ConversationService` if not already

**Interfaces:**
- Consumes: `UIChatService`, `JwtAuthGuard`, `CurrentUser`
- Produces: HTTP routes as spec

- [ ] **Step 1: Ensure ConversationModule exports ConversationService**

```ts
// conversation.module.ts
exports: [ConversationService],
```

- [ ] **Step 2: Implement controller**

```ts
@Controller("api/ui-chat")
@UseGuards(JwtAuthGuard)
export class UIChatController {
  constructor(private readonly uiChat: UIChatService) {}

  @Post(":conversationId/chat")
  chat(
    @CurrentUser() user: CurrentUserData,
    @Param("conversationId") conversationId: string,
    @Body() body: { input: string },
  ) {
    return this.uiChat.chat(user.userId, conversationId, body.input);
  }

  @Post(":conversationId/action")
  action(
    @CurrentUser() user: CurrentUserData,
    @Param("conversationId") conversationId: string,
    @Body() body: { action: UIAction },
  ) {
    return this.uiChat.action(user.userId, conversationId, body.action);
  }
}
```

Leave analyze/stream for Task 7 (add stub route that throws `NotImplementedException` **or** omit until Task 7 — **omit** until Task 7).

- [ ] **Step 3: Module**

```ts
@Module({
  imports: [AuthModule, ConversationModule],
  controllers: [UIChatController],
  providers: [UIResponseService, UIOrchestrateAdapter, UIChatService],
})
export class UiChatModule {}
```

Prisma is global — no import needed.

- [ ] **Step 4: Register in AppModule**

```ts
imports: [..., UiChatModule],
```

- [ ] **Step 5: Typecheck**

```bash
cd services/chat && bun run typecheck
```

Expected: PASS

- [ ] **Step 6: Manual smoke (optional if env has DB + JWT)**

```bash
# login → create conversation → POST /api/ui-chat/:id/chat with Bearer token
```

- [ ] **Step 7: Commit**

```bash
git add services/chat/src/llm/ui-protocol/ui-chat.controller.ts services/chat/src/llm/ui-protocol/ui-chat.module.ts services/chat/src/app.module.ts services/chat/src/conversation/conversation.module.ts
git commit -m "feat(chat): expose JWT ui-chat sync endpoints"
```

---

### Task 7: analyze/stream SSE

**Files:**
- Modify: `services/chat/src/llm/ui-protocol/ui-chat.service.ts` — add `analyzeStream`
- Modify: `services/chat/src/llm/ui-protocol/ui-chat.controller.ts` — SSE endpoint
- Create: `services/chat/src/llm/ui-protocol/stream-format.ts` — `formatSse(data: StreamMessage): string`
- Test: `services/chat/test/ui-stream-format.spec.ts`

**Interfaces:**
- Produces:
  - `formatSse(message: StreamMessage): string` → `data: ${JSON.stringify(message)}\n\n`
  - `UIChatService.analyzeStream(userId, conversationId): AsyncGenerator<StreamMessage>`
  - `POST /api/ui-chat/:conversationId/analyze/stream`

- [ ] **Step 1: Failing test for formatSse**

```ts
import { describe, expect, test } from "bun:test";
import { formatSse } from "../src/llm/ui-protocol/stream-format";

test("formatSse wraps JSON with data prefix", () => {
  const out = formatSse({
    messageType: "done",
    timestamp: "2026-08-04T00:00:00.000Z",
    payload: null,
  });
  expect(out.startsWith("data: ")).toBe(true);
  expect(out.endsWith("\n\n")).toBe(true);
  expect(JSON.parse(out.slice(6, -2)).messageType).toBe("done");
});
```

- [ ] **Step 2: Implement formatSse + analyzeStream**

```ts
async *analyzeStream(
  userId: string,
  conversationId: string,
): AsyncGenerator<StreamMessage> {
  await this.conversations.getOwnedOrThrow(userId, conversationId);
  const rows = await this.prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
  const collected = extractCollectedData(rows);
  const now = () => new Date().toISOString();
  const messageId = `ui-${Date.now()}`;

  yield {
    messageType: "progress",
    timestamp: now(),
    payload: { step: 1, totalSteps: 3, agent: "prepare", status: "started" },
  };
  yield {
    messageType: "progress",
    timestamp: now(),
    payload: { step: 2, totalSteps: 3, agent: "orchestrate", status: "started" },
  };

  let ui: AIUIResponse;
  try {
    ui = await this.orchestrateAdapter.analyze(collected, "用户确认提交分析");
  } catch (err) {
    yield {
      messageType: "error",
      timestamp: now(),
      payload: {
        message: err instanceof Error ? err.message : "analyze failed",
      },
    };
    return; // do not persist
  }

  yield {
    messageType: "progress",
    timestamp: now(),
    payload: { step: 3, totalSteps: 3, agent: "orchestrate", status: "completed" },
  };

  yield {
    messageType: "markdown",
    timestamp: now(),
    payload: { content: ui.message, isChunk: false, messageId },
  };

  yield {
    messageType: "ui",
    timestamp: now(),
    payload: { messageId, components: ui.components, thinking: undefined },
  };

  const historyDb = new DatabaseChatMessageHistory(this.prisma, conversationId);
  await historyDb.addMessage("ai", ui.message, { ui });

  yield { messageType: "done", timestamp: now(), payload: null };
}
```

Controller (Express raw response for SSE — match Nest patterns used elsewhere or use `@Sse` with Observable). Prefer explicit:

```ts
@Post(":conversationId/analyze/stream")
async analyzeStream(
  @CurrentUser() user: CurrentUserData,
  @Param("conversationId") conversationId: string,
  @Res() res: Response,
) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  try {
    for await (const msg of this.uiChat.analyzeStream(user.userId, conversationId)) {
      res.write(formatSse(msg));
    }
  } catch (err) {
    res.write(
      formatSse({
        messageType: "error",
        timestamp: new Date().toISOString(),
        payload: { message: err instanceof Error ? err.message : "error" },
      }),
    );
  } finally {
    res.end();
  }
}
```

Import `Response` from `express`.

- [ ] **Step 3: Tests PASS + typecheck**

```bash
cd services/chat && bun test test/ui-stream-format.spec.ts
cd services/chat && bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add services/chat/src/llm/ui-protocol/stream-format.ts services/chat/src/llm/ui-protocol/ui-chat.service.ts services/chat/src/llm/ui-protocol/ui-chat.controller.ts services/chat/test/ui-stream-format.spec.ts
git commit -m "feat(chat): add ui-chat analyze SSE stream with orchestrate adapter"
```

---

### Task 8: Frontend UI types + ComponentRenderer + widgets

**Files:**
- Create: `clients/chat-web/types/ui-types.ts` (mirror backend types needed by UI)
- Create: `clients/chat-web/components/ai-ui/ComponentRenderer.tsx`
- Create: `clients/chat-web/components/ai-ui/SelectionCard.tsx`
- Create: `clients/chat-web/components/ai-ui/DynamicForm.tsx`
- Create: `clients/chat-web/components/ai-ui/ConfirmationDialog.tsx`
- Create: `clients/chat-web/components/ai-ui/InfoCard.tsx`
- Create: `clients/chat-web/components/ai-ui/StepsProgress.tsx`
- Create: `clients/chat-web/components/ai-ui/DataTable.tsx`
- Create: `clients/chat-web/components/ai-ui/ActionButtons.tsx`

**Interfaces:**
- Consumes: `UIResponse`, `UIAction`
- Produces: `ComponentRenderer({ component, onAction, disabled? })`

- [ ] **Step 1: Port types**

Copy component unions from backend `ui-types.ts` into `clients/chat-web/types/ui-types.ts` (frontend-only; keep in sync manually). Include `AIUIResponse`, `UIAction`, `StreamMessage`, `AIUIResponseWithStreamHint`.

- [ ] **Step 2: Implement widgets with inline styles** (no Tailwind required)

Each widget calls `onAction` with the correct `UIAction` shape. Unknown types handled in renderer:

```tsx
export function ComponentRenderer({
  component,
  onAction,
  disabled,
}: {
  component: UIResponse;
  onAction: (action: UIAction) => void;
  disabled?: boolean;
}) {
  switch (component.type) {
    case "text":
      return <div style={{ whiteSpace: "pre-wrap" }}>{component.content}</div>;
    case "selection":
      return <SelectionCard {...component} disabled={disabled} onSelect={(selectedId) => onAction({ componentType: "selection", payload: { type: "select", selectedId } })} />;
    case "form":
      return <DynamicForm {...component} disabled={disabled} onSubmit={(formData) => onAction({ componentType: "form", payload: { type: "submit", formData } })} />;
    case "confirmation":
      return (
        <ConfirmationDialog
          {...component}
          disabled={disabled}
          onConfirm={() => onAction({ componentType: "confirmation", payload: { type: "confirm", confirmed: true } })}
          onCancel={() => onAction({ componentType: "confirmation", payload: { type: "confirm", confirmed: false } })}
        />
      );
    case "card":
      return <InfoCard {...component} disabled={disabled} onAction={(actionId) => onAction({ componentType: "card", payload: { type: "click", actionId } })} />;
    case "steps":
      return <StepsProgress {...component} />;
    case "table":
      return <DataTable {...component} disabled={disabled} onRowSelect={(rowIndex) => onAction({ componentType: "table", payload: { type: "row_select", rowIndex } })} />;
    case "action_buttons":
      return <ActionButtons {...component} disabled={disabled} onClick={(actionId) => onAction({ componentType: "action_buttons", payload: { type: "click", actionId } })} />;
    default:
      return <div>[不支持的组件类型: {(component as { type: string }).type}]</div>;
  }
}
```

Port structure from feat/ai-ui components; simplify CSS to inline styles matching existing `app/page.tsx` aesthetic.

- [ ] **Step 3: Typecheck chat-web**

```bash
cd clients/chat-web && bun run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add clients/chat-web/types clients/chat-web/components/ai-ui
git commit -m "feat(chat-web): add AI UI ComponentRenderer and widgets"
```

---

### Task 9: AIChatContainer + page wiring + SSE client

**Files:**
- Create: `clients/chat-web/components/ai-ui/AIChatContainer.tsx`
- Create: `clients/chat-web/lib/api.ts` (auth + fetch helpers)
- Modify: `clients/chat-web/app/page.tsx`
- Create: `clients/chat-web/.env.example`
- Modify: `clients/chat-web/package.json` only if adding deps — **prefer native fetch + ReadableStream** for SSE (no new dep)

**Interfaces:**
- Consumes: chat API base URL, JWT in `localStorage` key `chat_token`
- Flow: login/register UI minimal → create conversation → chat/action → on `streamSuggested` call analyze/stream and parse SSE

- [ ] **Step 1: Implement API helpers**

```ts
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";

export async function login(email: string, password: string) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("login failed");
  return res.json() as Promise<{ accessToken: string }>;
}

export async function createConversation(token: string) {
  const res = await fetch(`${API}/api/conversations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("create conversation failed");
  return res.json() as Promise<{ id: string }>;
}
```

Check actual auth response field name in `auth.service.ts` and match it exactly (`access_token` vs `accessToken`).

- [ ] **Step 2: Implement AIChatContainer**

State: `messages: { role; content; components? }[]`, `streamingMessage`, `token`, `conversationId`, `loading`.

- `handleSend` → `POST /api/ui-chat/:id/chat`
- `handleAction` → `POST /api/ui-chat/:id/action`; if `streamSuggested`, call `runAnalyzeStream`
- `runAnalyzeStream` → `POST /api/ui-chat/:id/analyze/stream`, read body stream, split on `\n\n`, parse `data: ` JSON `StreamMessage`, update UI:
  - `progress` → show indicator text
  - `markdown` → append to streaming content
  - `ui` → set components on streaming message
  - `done` → flush streaming into messages
  - `error` → show error

- [ ] **Step 3: Replace page.tsx** to render login strip + `AIChatContainer`

- [ ] **Step 4: Add `.env.example`**

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4001
```

- [ ] **Step 5: Typecheck**

```bash
cd clients/chat-web && bun run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add clients/chat-web
git commit -m "feat(chat-web): wire AIChatContainer with ui-chat and analyze SSE"
```

---

### Task 10: Smoke script + learning-path note

**Files:**
- Create: `services/chat/scripts/ch6-ui-smoke.md` (curl runbook) **or** `docs/chat/ch6-ui-runbook.md`
- Modify: `docs/learning-path.md` — mark Ch6 branch as `feat/LangChain-Advanced-UI` / reference feat/ai-ui

- [ ] **Step 1: Write runbook** covering:

1. Register/login
2. Create conversation
3. `POST .../chat` with「我要提一个新需求」
4. `POST .../action` select / submit / confirm
5. `POST .../analyze/stream` and expect progress → markdown → ui → done
6. `GET .../messages` shows `metadata.ui`
7. Confirm old `POST /api/conversations/:id/chat` still works

- [ ] **Step 2: Update learning-path.md row for 第六章** to point at this branch/spec/plan

- [ ] **Step 3: Run full chat unit tests**

```bash
cd services/chat && bun test
```

Expected: all PASS (existing + new)

- [ ] **Step 4: Commit**

```bash
git add docs/learning-path.md docs/chat/ch6-ui-runbook.md
git commit -m "docs(chat): add Ch6 UI smoke runbook and learning-path pointer"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| UI types + Zod + validate | Task 1 |
| LLM Structured Output | Task 4 |
| UIAction + collectedData persistence | Task 3, 5 |
| confirm → streamSuggested only | Task 5 |
| orchestrate adapter mapping | Task 2 |
| analyze/stream SSE | Task 7 |
| JWT + Conversation ownership | Task 6 |
| Frontend ComponentRenderer | Task 8 |
| AIChatContainer + SSE client | Task 9 |
| Keep text chat / doc SSE unchanged | Task 6/7 (no edits to those files) |
| Acceptance / runbook | Task 10 |

**Placeholder scan:** none intentional; auth token field name must be verified against `auth.service.ts` in Task 9.

**Type consistency:** `AIUIResponse.version: '1.0'`, `AIUIResponseWithStreamHint`, `StreamMessage`, `isConfirmAnalyze`, `validateUIResponse`, `mapOrchestrateToUI` used consistently across tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-04-langchain-ch6-ai-ui.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个 Task 派生子代理，Task 间审查，迭代快  

**2. Inline Execution** — 本会话用 executing-plans 按 Task 批量执行并设检查点  

Which approach?
