import {
  Annotation,
  END,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import { z } from "zod";

export const emailActionSchema = z
  .object({
    to: z.string().email(),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const approvalDecisionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("approve") }).strict(),
  z
    .object({
      type: z.literal("edit"),
      action: emailActionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("reject"),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
]);

export type EmailAction = z.infer<typeof emailActionSchema>;
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
export type WorkflowStatus =
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "completed";

export type ApprovalRequest = {
  kind: "email_approval";
  proposal: EmailAction;
  allowedDecisions: ["approve", "edit", "reject"];
  instruction: string;
};

export type SentEmail = EmailAction & { sentAt: string };

export const ApprovalState = Annotation.Root({
  request: Annotation<string>(),
  proposal: Annotation<EmailAction | null>(),
  decision: Annotation<ApprovalDecision | null>(),
  approvedAction: Annotation<EmailAction | null>(),
  status: Annotation<WorkflowStatus>(),
  result: Annotation<string | null>(),
  audit: Annotation<string[], string[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
});

type State = typeof ApprovalState.State;

function requireProposal(state: State): EmailAction {
  if (!state.proposal) throw new Error("审批节点缺少待审批操作。");
  return emailActionSchema.parse(state.proposal);
}

function draftAction(state: State): typeof ApprovalState.Update {
  const request = state.request.trim();
  if (!request) throw new Error("request 不能为空。");

  return {
    proposal: {
      to: "team@example.com",
      subject: "需要人工审批的操作建议",
      body: `根据用户请求生成的模拟通知：${request}`,
    },
    status: "awaiting_review",
    result: null,
    audit: ["draft：已生成邮件操作建议，尚未产生发送副作用。"],
  };
}

function reviewAction(state: State): typeof ApprovalState.Update {
  const proposal = requireProposal(state);
  const request: ApprovalRequest = {
    kind: "email_approval",
    proposal,
    allowedDecisions: ["approve", "edit", "reject"],
    instruction: "请批准、修改或拒绝这封模拟邮件。",
  };

  // interrupt() 之前不执行外部副作用。首次运行在这里暂停；恢复时返回
  // Command({ resume }) 携带的结构化决策，然后从本节点继续。
  const decision = approvalDecisionSchema.parse(
    interrupt<ApprovalRequest, unknown>(request),
  );

  if (decision.type === "reject") {
    return {
      decision,
      approvedAction: null,
      status: "rejected",
      result: `操作已拒绝：${decision.reason}`,
      audit: [`review：人工拒绝操作，原因：${decision.reason}`],
    };
  }

  const approvedAction =
    decision.type === "edit" ? decision.action : proposal;
  return {
    decision,
    approvedAction,
    status: "approved",
    audit: [
      decision.type === "edit"
        ? "review：人工修改并批准操作。"
        : "review：人工批准原始操作。",
    ],
  };
}

function routeAfterReview(state: State): "execute" | "rejected" {
  return state.status === "rejected" ? "rejected" : "execute";
}

export function createNativeApprovalGraph(outbox: SentEmail[]) {
  const executeAction = (state: State): typeof ApprovalState.Update => {
    if (!state.approvedAction || state.status !== "approved") {
      throw new Error("只有已批准的操作才能执行。");
    }

    const action = emailActionSchema.parse(state.approvedAction);
    outbox.push({ ...action, sentAt: new Date().toISOString() });
    return {
      status: "completed",
      result: `模拟邮件已发送至 ${action.to}，主题：${action.subject}`,
      audit: ["execute：审批通过后执行模拟发送。"],
    };
  };

  return new StateGraph(ApprovalState)
    .addNode("draft", draftAction)
    .addNode("review", reviewAction)
    .addNode("execute", executeAction)
    .addEdge(START, "draft")
    .addEdge("draft", "review")
    .addConditionalEdges("review", routeAfterReview, {
      execute: "execute",
      rejected: END,
    })
    .addEdge("execute", END)
    .compile({ checkpointer: new MemorySaver() });
}

