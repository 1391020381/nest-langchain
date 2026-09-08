/**
 * Opt-in provider test. It is excluded from the default, zero-key test path.
 *
 * Run from this workspace with:
 * RUN_LIVE_DEEPAGENT_TESTS=1 bun test test/live-deepagent.spec.ts
 */
import { describe, expect, test } from "bun:test";
import { config } from "dotenv";
import { join } from "node:path";
import { DeepAgentRuntime } from "../src/agent/deepagent.runtime";
import type { RuntimeEvent } from "../src/agent/types";

config({ path: join(import.meta.dir, "..", ".env"), quiet: true });

const RUN_LIVE =
  process.env.RUN_LIVE_DEEPAGENT_TESTS === "1" &&
  Boolean(process.env.OPENAI_API_KEY?.trim());

describe("live DeepAgent application smoke", () => {
  if (!RUN_LIVE) {
    test.skip(
      "requires RUN_LIVE_DEEPAGENT_TESTS=1 and OPENAI_API_KEY",
      () => {},
    );
    return;
  }

  test(
    "the configured provider completes the real multi-agent requirement flow",
    async () => {
      const runtime = new DeepAgentRuntime();
      const events: RuntimeEvent[] = [];

      for await (const event of runtime.stream(
        "作为企业管理员，我需要批量导入成员。单次最多 10,000 条，失败记录可下载，所有操作必须保留审计日志，并给出 Given-When-Then 验收标准。",
        { runId: "live-smoke", threadId: "live-smoke-thread" },
      )) {
        events.push(event);
      }

      const final = events.find(
        (event): event is Extract<RuntimeEvent, { type: "final" }> =>
          event.type === "final",
      );
      expect(final).toBeDefined();
      expect(final?.report.length).toBeGreaterThan(200);
      expect(final?.artifacts["/work/final-report.md"]?.length).toBeGreaterThan(
        200,
      );
      expect(final?.usedAgents).toEqual(
        expect.arrayContaining([
          "requirement-analyst",
          "risk-reviewer",
          "acceptance-designer",
        ]),
      );
      expect(final?.toolCalls).toEqual(
        expect.arrayContaining(["write_todos", "task", "write_file"]),
      );
      expect(final?.todos.length).toBeGreaterThan(0);
      expect(final?.todos.every((todo) => todo.status === "completed")).toBe(
        true,
      );
      expect(events.at(-1)?.type).toBe("final");
    },
    300_000,
  );
});
