import { createDeepAgent } from "deepagents";
import { MemorySaver, interrupt } from "@langchain/langgraph";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const emailSchema = z.object({
  to: z.string().email().max(254),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
}).strict();
export const questionSchema = z.object({ question: z.string().min(1).max(2000) }).strict();
export type Mail = z.infer<typeof emailSchema> & { sentAt: string };

// 只替换模型输出；工具审批、checkpoint 和恢复均走真正的 Deep Agents。
export class DemoModel extends BaseChatModel {
  constructor() { super({}); }
  _llmType() { return "hitl-offline-demo"; }
  bindTools() { return this; }
  async _generate(messages: BaseMessage[]) {
    const results = messages.filter((m) => m.type === "tool");
    const prompt = String(messages.find((m) => m.type === "human")?.content || "");
    let message: AIMessage;
    if (results.length) {
      message = new AIMessage(`流程结束。工具或人工反馈：\n${results.map((m) => String(m.content)).join("\n")}`);
    } else if (prompt.includes("提问")) {
      message = new AIMessage({ content: "先确认报告偏好。", tool_calls: [
        { id: "ask-1", name: "ask_user", args: { question: "报告面向技术团队还是管理层？希望多长？" } },
      ] });
    } else {
      const recipients = prompt.includes("批量") ? ["team@example.com", "manager@example.com"] : ["team@example.com"];
      message = new AIMessage({ content: "邮件草稿已准备好，等待人工审批。", tool_calls: recipients.map((to, i) => ({
        id: `email-${i}`, name: "send_email", args: { to, subject: "Agent 研究报告", body: "本次研究介绍了 Deep Agents 的任务规划、子 Agent 与人工审批机制。请查阅并反馈。" },
      })) });
    }
    return { generations: [{ text: String(message.content), message }] };
  }
}

export function createApprovalAgent(model: BaseChatModel, outbox: Mail[]) {
  const sendEmail = new DynamicStructuredTool({
    name: "send_email", description: "模拟发送邮件，写入当前会话的模拟发件箱，不连接邮件服务。",
    schema: emailSchema,
    func: async (args) => {
      outbox.push({ ...args, sentAt: new Date().toISOString() });
      return `模拟邮件已发送至 ${args.to}，主题：${args.subject}`;
    },
  });
  const askUser = new DynamicStructuredTool({
    name: "ask_user", description: "向用户提问，用户通过 respond 返回回答。",
    // 当前 JS HITL 中间件仅支持 approve/edit/reject。
    // 人工回答使用本章的底层 interrupt()，前端统一显示为 respond。
    schema: questionSchema, func: async (args) => {
      const answer = interrupt({
        actionRequests: [{ name: "ask_user", args }],
        reviewConfigs: [{ actionName: "ask_user", allowedDecisions: ["respond"] }],
      });
      return z.object({ decisions: z.tuple([z.object({ type: z.literal("respond"), message: z.string().min(1) })]) }).parse(answer).decisions[0].message;
    },
  });
  return createDeepAgent({
    model, tools: [sendEmail, askUser], checkpointer: new MemorySaver(),
    interruptOn: {
      send_email: { allowedDecisions: ["approve", "edit", "reject"] },
    },
    systemPrompt: `你是人机协作教学助手，用中文回答。用户要求发送邮件时，起草邮件并调用 send_email，由框架暂停审批。
用户要求批量邮件时，尽量在同一轮提出多个 send_email 调用。用户要求提问时调用 ask_user。
所有发送都是模拟，不要声称真实邮件已经送达。收到 reject 后停止该操作并说明原因，不重试，不委派其他工具绕过。
收到 ask_user 回答后简要确认并结束。简单任务无需规划、文件或子 Agent。`,
  });
}
