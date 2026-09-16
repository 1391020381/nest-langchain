import { randomUUID } from "node:crypto";
import { Command } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod";
import { createApprovalAgent, emailSchema, type Mail } from "./agent";

const kind = z.enum(["approve", "edit", "reject", "respond"]);
const interruptSchema = z.object({ id: z.string(), value: z.object({
  actionRequests: z.array(z.object({ name: z.string(), args: z.record(z.unknown()) })),
  reviewConfigs: z.array(z.object({ actionName: z.string(), allowedDecisions: z.array(kind) })),
}) });
export const resumeSchema = z.object({
  revision: z.number().int().nonnegative(),
  reviews: z.array(z.object({ interruptId: z.string(), decisions: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("approve") }).strict(),
    z.object({ type: z.literal("edit"), editedAction: z.object({ name: z.string(), args: emailSchema }).strict() }).strict(),
    z.object({ type: z.literal("reject"), message: z.string().trim().min(1).max(2000) }).strict(),
    z.object({ type: z.literal("respond"), message: z.string().trim().min(1).max(2000) }).strict(),
  ])) }).strict()).min(1),
}).strict();
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
type Agent = ReturnType<typeof createApprovalAgent>;
type Pending = z.infer<typeof interruptSchema>;
type Session = { id: string; agent: Agent; outbox: Mail[]; status: "running" | "interrupted" | "completed" | "error";
  revision: number; pending: Pending[]; messages: { role: string; content: unknown }[]; error?: string; busy: boolean };

export class Sessions {
  private sessions = new Map<string, Session>();
  constructor(private model: () => BaseChatModel) {}
  create(prompt: string) {
    if (this.sessions.size >= 100) throw new HttpError(429, "演示会话已达 100 个，请重启服务清理。");
    const outbox: Mail[] = [];
    const s: Session = { id: randomUUID(), agent: createApprovalAgent(this.model(), outbox), outbox,
      status: "running", revision: 0, pending: [], messages: [], busy: false };
    this.sessions.set(s.id, s);
    void this.run(s, { messages: [{ role: "user", content: prompt }] });
    return this.view(s.id);
  }
  private get(id: string) { const s = this.sessions.get(id); if (!s) throw new HttpError(404, "会话不存在，服务重启后需新建会话。"); return s; }
  view(id: string) {
    const s = this.get(id);
    return { id: s.id, status: s.status, revision: s.revision, pending: s.pending, messages: s.messages, outbox: s.outbox, error: s.error };
  }
  resume(id: string, input: z.infer<typeof resumeSchema>) {
    const s = this.get(id);
    if (s.busy || s.status !== "interrupted" || input.revision !== s.revision) throw new HttpError(409, "审批已更新或已提交，请刷新状态。");
    if (input.reviews.length !== s.pending.length || new Set(input.reviews.map((r) => r.interruptId)).size !== s.pending.length)
      throw new HttpError(400, "需为每一个中断提供一组决策。");
    const resume: Record<string, unknown> = {};
    for (const pending of s.pending) {
      const review = input.reviews.find((r) => r.interruptId === pending.id);
      if (!review || review.decisions.length !== pending.value.actionRequests.length) throw new HttpError(400, "决策必须与待审批操作一一对应。");
      // langchain 1.5.4 一旦批次中含 reject 就跳回模型，丢弃同批获批调用。
      // 明确拒绝混合提交，避免向用户暗示获批项一定会执行。
      const rejected = review.decisions.filter((d) => d.type === "reject").length;
      if (rejected && rejected !== review.decisions.length) throw new HttpError(400, "当前 JS 版本不支持同批混合批准与拒绝。请全部拒绝后新建任务，或将全部操作批准/修改。");
      review.decisions.forEach((decision, i) => {
        const action = pending.value.actionRequests[i];
        const config = pending.value.reviewConfigs.find((r) => r.actionName === action.name);
        if (!config?.allowedDecisions.includes(decision.type)) throw new HttpError(400, "该操作不支持此决策。");
        if (decision.type === "edit" && (decision.editedAction.name !== action.name || action.name !== "send_email"))
          throw new HttpError(400, "只能修改邮件参数，不能替换工具。");
      });
      resume[pending.id] = { decisions: review.decisions };
    }
    s.revision++;
    void this.run(s, new Command({ resume }));
    return this.view(id);
  }
  private async run(s: Session, input: Parameters<Agent["invoke"]>[0]) {
    s.busy = true; s.status = "running"; s.error = undefined;
    const config = { configurable: { thread_id: s.id }, recursionLimit: 30, runName: "ch09-human-in-the-loop" };
    try {
      await s.agent.invoke(input, config);
      const state = await s.agent.graph.getState(config);
      s.messages = (state.values.messages ?? []).map((m: { type?: string; content: unknown }) => ({ role: m.type || "message", content: m.content }));
      // 读取 checkpoint 中的中断，兼容 invoke 返回值的不同版本。
      s.pending = state.tasks.flatMap((task) => task.interrupts ?? []).map((intr) => {
        const value = intr.value as { actionRequests: { args?: unknown; arguments?: unknown }[] };
        return interruptSchema.parse({ ...intr, value: { ...value, actionRequests: value.actionRequests.map((a) => ({ ...a, args: a.args ?? a.arguments })) } });
      });
      s.status = s.pending.length ? "interrupted" : "completed";
    } catch (error) {
      s.status = "error"; s.pending = [];
      // 不把模型服务错误原文（可能含认证信息）暴露给浏览器。
      const status = typeof error === "object" && error && "status" in error ? String(error.status) : "";
      s.error = `执行失败${/^\d{3}$/.test(status) ? `（HTTP ${status}）` : ""}，请检查模型配置、余额和网络，再新建会话。`;
    } finally { s.busy = false; }
  }
}
