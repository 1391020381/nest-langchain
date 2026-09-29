import type { BaseMessage } from "@langchain/core/messages";

const PRODUCERS: Record<string, string> = {
  system: "应用开发者",
  human: "用户",
  ai: "模型",
  tool: "应用中的 Tool 执行器",
};

export type MessageInspection = {
  type: string;
  producer: string;
  content: unknown;
  toolCalls: Array<{ id?: string; name: string; args: unknown }>;
  toolCallId?: string;
};

/** 把 LangChain Message 转成便于学习和打印的结构。 */
export function inspectMessage(message: BaseMessage): MessageInspection {
  const type = message.getType();
  const candidate = message as BaseMessage & {
    tool_calls?: Array<{ id?: string; name: string; args: unknown }>;
    tool_call_id?: string;
  };

  return {
    type,
    producer: PRODUCERS[type] ?? "未知来源",
    content: message.content,
    toolCalls: (candidate.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.name,
      args: call.args,
    })),
    toolCallId: candidate.tool_call_id,
  };
}

export function printMessage(index: number, message: BaseMessage): void {
  const inspected = inspectMessage(message);
  console.log(`\n[${index}] ${inspected.type} · 产生者：${inspected.producer}`);
  if (inspected.content !== "" && inspected.content !== undefined) {
    console.log("content:", inspected.content);
  }
  if (inspected.toolCalls.length > 0) {
    console.log("tool_calls:", JSON.stringify(inspected.toolCalls, null, 2));
  }
  if (inspected.toolCallId) {
    console.log("tool_call_id:", inspected.toolCallId);
  }
}

