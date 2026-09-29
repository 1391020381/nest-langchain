import { Command } from "@langchain/langgraph";
import { randomUUID } from "node:crypto";

import {
  approvalDecisionSchema,
  createNativeApprovalGraph,
  type ApprovalDecision,
  type ApprovalRequest,
  type SentEmail,
} from "./graph";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Graph = ReturnType<typeof createNativeApprovalGraph>;
type SessionStatus =
  | "running"
  | "interrupted"
  | "completed"
  | "rejected"
  | "error";

type Session = {
  id: string;
  request: string;
  graph: Graph;
  outbox: SentEmail[];
  status: SessionStatus;
  revision: number;
  pending: { id?: string; value: ApprovalRequest } | null;
  proposal: unknown;
  result: unknown;
  audit: string[];
  busy: boolean;
};

export type ResumeInput = {
  revision: number;
  decision: ApprovalDecision;
};

export class NativeApprovalSessions {
  private readonly sessions = new Map<string, Session>();

  private config(session: Session) {
    return {
      configurable: { thread_id: session.id },
      runName: "stage3-native-langgraph-hitl",
      tags: ["deepagents-in-action", "stage3", "native-langgraph-hitl"],
      metadata: {
        tutorial_stage: "native-langgraph-hitl",
        session_id: session.id,
      },
    };
  }

  private get(id: string): Session {
    const session = this.sessions.get(id);
    if (!session) throw new HttpError(404, "审批会话不存在或服务已重启。");
    return session;
  }

  private async refresh(session: Session) {
    const snapshot = await session.graph.getState(this.config(session));
    const interrupts = snapshot.tasks.flatMap((task) => task.interrupts ?? []);
    if (interrupts.length > 1) {
      throw new Error("教学流程预期最多只有一个待处理 interrupt。");
    }

    const state = snapshot.values;
    session.pending = interrupts[0]
      ? {
          id: interrupts[0].id,
          value: interrupts[0].value as ApprovalRequest,
        }
      : null;
    session.proposal = state.proposal ?? null;
    session.result = state.result ?? null;
    session.audit = Array.isArray(state.audit) ? state.audit : [];
    session.status = session.pending
      ? "interrupted"
      : state.status === "rejected"
        ? "rejected"
        : "completed";
  }

  view(id: string) {
    const session = this.get(id);
    return {
      id: session.id,
      request: session.request,
      status: session.status,
      revision: session.revision,
      pending: session.pending,
      proposal: session.proposal,
      result: session.result,
      audit: session.audit,
      outbox: session.outbox,
    };
  }

  async create(request: string) {
    if (this.sessions.size >= 100) {
      throw new HttpError(429, "演示会话已达 100 个，请重启服务清理。");
    }

    const outbox: SentEmail[] = [];
    const session: Session = {
      id: randomUUID(),
      request,
      graph: createNativeApprovalGraph(outbox),
      outbox,
      status: "running",
      revision: 0,
      pending: null,
      proposal: null,
      result: null,
      audit: [],
      busy: true,
    };
    this.sessions.set(session.id, session);

    try {
      await session.graph.invoke({ request }, this.config(session));
      await this.refresh(session);
      if (session.status !== "interrupted") {
        throw new Error("流程没有在人工审批节点暂停。");
      }
      return this.view(session.id);
    } catch (error) {
      session.status = "error";
      throw error;
    } finally {
      session.busy = false;
    }
  }

  async resume(id: string, input: ResumeInput) {
    const session = this.get(id);
    if (
      session.busy ||
      session.status !== "interrupted" ||
      input.revision !== session.revision
    ) {
      throw new HttpError(409, "审批状态已更新，请刷新页面后重试。");
    }

    const decision = approvalDecisionSchema.parse(input.decision);
    session.busy = true;
    session.status = "running";
    session.revision += 1;
    try {
      await session.graph.invoke(
        new Command({ resume: decision }),
        this.config(session),
      );
      await this.refresh(session);
      return this.view(session.id);
    } catch (error) {
      session.status = "error";
      throw error;
    } finally {
      session.busy = false;
    }
  }
}

