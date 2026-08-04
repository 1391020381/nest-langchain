import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

export const EXPERT_NAMES = [
  "functional",
  "performance",
  "security",
  "compliance",
] as const;

export type ExpertName = (typeof EXPERT_NAMES)[number];
export type Intent = "chat" | "query" | "analyze";

/** 专家使用独立消息通道，避免并行工具消息污染主图。 */
export const ExpertState = Annotation.Root({
  ...MessagesAnnotation.spec,
  toolRounds: Annotation<number>({
    reducer: (_previous, next) => next,
    default: () => 0,
  }),
});

/** 主图共享状态；并发专家分别写独立字段，再由 Aggregator 合并。 */
export const RequirementState = Annotation.Root({
  input: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => "",
  }),
  intent: Annotation<Intent>({
    reducer: (_previous, next) => next,
    default: () => "analyze",
  }),
  directAnswer: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => "",
  }),
  activeExperts: Annotation<ExpertName[]>({
    reducer: (_previous, next) => next,
    default: () => [],
  }),
  functionalAnalysis: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => "",
  }),
  performanceAnalysis: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => "",
  }),
  securityAnalysis: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => "",
  }),
  complianceAnalysis: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => "",
  }),
  analysisResult: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => "",
  }),
  summary: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => "",
  }),
  critique: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => "",
  }),
  reviseCount: Annotation<number>({
    reducer: (_previous, next) => next,
    default: () => 0,
  }),
});

export type RequirementGraphState = typeof RequirementState.State;
export type RequirementGraphUpdate = Partial<RequirementGraphState>;
