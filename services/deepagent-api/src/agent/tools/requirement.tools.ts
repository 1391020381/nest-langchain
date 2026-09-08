import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const DIMENSIONS = [
  {
    name: "用户与场景",
    patterns: [/作为/u, /用户/u, /客户/u, /管理员/u, /运营/u, /开发者/u],
  },
  {
    name: "目标与价值",
    patterns: [/为了/u, /目标/u, /希望/u, /需要/u, /价值/u, /解决/u],
  },
  {
    name: "功能范围",
    patterns: [/功能/u, /支持/u, /能够/u, /包括/u, /实现/u],
  },
  {
    name: "验收标准",
    patterns: [/验收/u, /必须/u, /成功/u, /失败/u, /given|when|then/iu],
  },
  {
    name: "非功能要求",
    patterns: [/性能/u, /安全/u, /权限/u, /并发/u, /延迟/u, /审计/u],
  },
  {
    name: "边界与例外",
    patterns: [/最多/u, /至少/u, /不超过/u, /异常/u, /边界/u, /限制/u],
  },
] as const;

export type CompletenessAnalysis = {
  score: number;
  covered: string[];
  missing: string[];
  questions: string[];
};

export type ComplexityEstimate = {
  size: "S" | "M" | "L" | "XL";
  estimatedDays: { min: number; max: number };
  factors: string[];
};

export function analyzeCompleteness(text: string): CompletenessAnalysis {
  const input = text.trim();
  const covered = DIMENSIONS.filter((dimension) =>
    dimension.patterns.some((pattern) => pattern.test(input)),
  ).map((dimension) => dimension.name);
  const missing = DIMENSIONS.map((dimension) => dimension.name).filter(
    (dimension) => !covered.includes(dimension),
  );

  return {
    score: Math.round((covered.length / DIMENSIONS.length) * 100),
    covered,
    missing,
    questions: missing.map((dimension) => `请补充「${dimension}」相关信息。`),
  };
}

export function estimateComplexity(text: string): ComplexityEstimate {
  const normalized = text.toLowerCase();
  let points = Math.max(1, Math.ceil(text.length / 150));
  const factors: string[] = [];
  const rules: Array<{ pattern: RegExp; points: number; factor: string }> = [
    {
      pattern: /第三方|api|集成|支付|登录/u,
      points: 2,
      factor: "外部系统集成",
    },
    {
      pattern: /批量|导入|导出|迁移|同步/u,
      points: 2,
      factor: "批处理或数据迁移",
    },
    {
      pattern: /权限|安全|审计|加密/u,
      points: 2,
      factor: "安全与权限",
    },
    {
      pattern: /实时|并发|高可用|性能|延迟/u,
      points: 2,
      factor: "性能与可靠性",
    },
    {
      pattern: /ai|agent|智能体|模型|rag|向量/u,
      points: 2,
      factor: "AI 非确定性",
    },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(normalized)) {
      points += rule.points;
      factors.push(rule.factor);
    }
  }
  if (factors.length === 0) factors.push("单一业务流程");

  if (points <= 2) {
    return { size: "S", estimatedDays: { min: 1, max: 3 }, factors };
  }
  if (points <= 5) {
    return { size: "M", estimatedDays: { min: 3, max: 7 }, factors };
  }
  if (points <= 8) {
    return { size: "L", estimatedDays: { min: 7, max: 15 }, factors };
  }
  return { size: "XL", estimatedDays: { min: 15, max: 30 }, factors };
}

export function createRequirementTools() {
  const analyzeCompletenessTool = new DynamicStructuredTool({
    name: "analyze_completeness",
    description:
      "按六个固定维度检查需求完整性，返回量化分数、缺失项和待澄清问题。",
    schema: z.object({
      requirementText: z.string().min(1).describe("完整的需求描述"),
    }),
    func: async ({ requirementText }) =>
      JSON.stringify(analyzeCompleteness(requirementText)),
  });

  const estimateComplexityTool = new DynamicStructuredTool({
    name: "estimate_complexity",
    description:
      "根据范围、外部集成、数据、安全、性能和 AI 因素估算复杂度与开发天数。",
    schema: z.object({
      requirementText: z.string().min(1).describe("完整的需求描述"),
    }),
    func: async ({ requirementText }) =>
      JSON.stringify(estimateComplexity(requirementText)),
  });

  return {
    analyzeCompletenessTool,
    estimateComplexityTool,
    all: [analyzeCompletenessTool, estimateComplexityTool],
  };
}
