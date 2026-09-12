import { tool } from "@langchain/core/tools";
import { interrupt } from "@langchain/langgraph";
import { z } from "zod";
import type {
  ClarificationAnswer,
  ClarificationQuestion,
  CompletenessAssessment,
} from "@autix/requirement-deepagent-contracts";

export const CLARIFICATION_TOOL_NAME = "request_requirement_clarification";

const questionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/u),
  field: z.enum([
    "actor",
    "goal",
    "input_format",
    "scope_limit",
    "failure_handling",
    "permission",
    "audit",
    "acceptance",
    "other",
  ]),
  label: z.string().min(1).max(80),
  prompt: z.string().min(1).max(300),
  required: z.boolean(),
  placeholder: z.string().max(200).optional(),
});

const clarificationSchema = z.object({
  completeness: z.object({
    complete: z.literal(false),
    score: z.number().min(0).max(1),
    missingFields: z.array(z.string().min(1)).min(1).max(8),
    reason: z.string().min(1).max(500),
  }),
  questions: z.array(questionSchema).min(1).max(6),
});

export interface ClarificationInterruptPayload {
  kind: "requirement_clarification";
  assessment: CompletenessAssessment;
  questions: ClarificationQuestion[];
}

export interface ClarificationResumePayload {
  kind: "requirement_clarification_answers";
  answers: ClarificationAnswer[];
}

export const requestRequirementClarificationTool = tool(
  ({ completeness, questions }) => {
    const response = interrupt<
      ClarificationInterruptPayload,
      ClarificationResumePayload
    >({
      kind: "requirement_clarification",
      assessment: completeness,
      questions,
    });
    return JSON.stringify({
      message: "用户已补充需求信息，请基于原始需求和以下答案继续分析。",
      answers: response.answers,
    });
  },
  {
    name: CLARIFICATION_TOOL_NAME,
    description:
      "当需求缺少会影响设计或验收的关键信息时，暂停运行并向用户提出结构化澄清问题。完整需求禁止调用。",
    schema: clarificationSchema,
  },
);
