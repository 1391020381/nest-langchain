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

export type { ExtractFields };

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

export async function orchestrate(input: string): Promise<OrchestrateResult> {
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
