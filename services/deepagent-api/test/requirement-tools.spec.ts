import { describe, expect, test } from "bun:test";
import {
  analyzeCompleteness,
  createRequirementTools,
  estimateComplexity,
} from "../src/agent/tools/requirement.tools";

describe("requirement tools", () => {
  test("a detailed requirement covers all six dimensions", () => {
    const result = analyzeCompleteness(
      "作为管理员，为了减少人工操作，我需要一个支持批量导入的功能；最多一万条，必须校验失败记录，并满足权限审计要求。",
    );

    expect(result.score).toBe(100);
    expect(result.covered).toEqual([
      "用户与场景",
      "目标与价值",
      "功能范围",
      "验收标准",
      "非功能要求",
      "边界与例外",
    ]);
    expect(result.missing).toEqual([]);
    expect(result.questions).toEqual([]);
  });

  test("a sparse requirement reports every missing dimension", () => {
    const result = analyzeCompleteness("做一个看板");

    expect(result.score).toBe(0);
    expect(result.covered).toEqual([]);
    expect(result.missing).toHaveLength(6);
    expect(result.questions).toHaveLength(6);
    expect(result.questions[0]).toContain(result.missing[0]);
  });

  test("complex integrations, data, security, performance, and AI produce XL", () => {
    const result = estimateComplexity(
      "集成第三方 API，批量迁移并同步数据，要求权限审计和加密、高并发低延迟，并使用 AI Agent、RAG 与向量检索。",
    );

    expect(result.size).toBe("XL");
    expect(result.estimatedDays).toEqual({ min: 15, max: 30 });
    expect(result.factors).toEqual([
      "外部系统集成",
      "批处理或数据迁移",
      "安全与权限",
      "性能与可靠性",
      "AI 非确定性",
    ]);
  });

  test("a small local wording change remains S", () => {
    expect(estimateComplexity("修改按钮颜色")).toEqual({
      size: "S",
      estimatedDays: { min: 1, max: 3 },
      factors: ["单一业务流程"],
    });
  });

  test("the real structured tools return the same deterministic results", async () => {
    const tools = createRequirementTools();
    const requirement =
      "作为运营，我需要支持导出功能，最多五千条，必须经过权限校验。";

    const completeness = JSON.parse(
      String(
        await tools.analyzeCompletenessTool.invoke({
          requirementText: requirement,
        }),
      ),
    );
    const complexity = JSON.parse(
      String(
        await tools.estimateComplexityTool.invoke({
          requirementText: requirement,
        }),
      ),
    );

    expect(completeness).toEqual(analyzeCompleteness(requirement));
    expect(complexity).toEqual(estimateComplexity(requirement));
    expect(tools.all.map((tool) => tool.name)).toEqual([
      "analyze_completeness",
      "estimate_complexity",
    ]);
  });

  test("structured tool schemas reject empty requirement text", async () => {
    const tools = createRequirementTools();

    await expect(
      tools.analyzeCompletenessTool.invoke({ requirementText: "" }),
    ).rejects.toThrow();
    await expect(
      tools.estimateComplexityTool.invoke({ requirementText: "" }),
    ).rejects.toThrow();
  });
});
