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
