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
