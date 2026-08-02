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

  test("manual_review with report appends but does not write ticket", async () => {
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
        status: "ok" as const,
        report: "# 分析报告\n需要人工复核",
        extract: { orderId: "EC20240315001" },
        usedAgents: ["RequirementExtractAgent", "ReportAgent"],
        fallback: "manual_review" as const,
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
    const result = await svc.analyze("demo", "复杂退货纠纷");

    expect(result.fallback).toBe("manual_review");
    expect(result.report).toBeTruthy();
    expect(wrote).toBe(false);
    expect(appended).toBe(true);
  });
});
