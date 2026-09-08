import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { createMiddleware } from "langchain";

type HistoryToolLimitOptions = {
  limit: number;
  toolName?: string;
  exitBehavior: "continue" | "end";
};

function matchesTool(toolName: string | undefined, expected?: string): boolean {
  return expected === undefined || toolName === expected;
}

/**
 * DeepAgent 的并行 task 会把子图结果合并回同一个父 step。LangChain 自带的
 * toolCallLimitMiddleware 使用 LastValue state 保存计数，多子图并行更新时会
 * 产生 INVALID_CONCURRENT_GRAPH_UPDATE。这里直接从消息历史计算次数，不新增
 * state channel，因此可以安全地用于并行子代理。
 */
export function createHistoryToolCallLimitMiddleware(
  options: HistoryToolLimitOptions,
) {
  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error("Tool call history limit must be a positive integer");
  }

  const label = options.toolName ?? "all";
  return createMiddleware({
    name: `HistoryToolCallLimit[${label}-${options.limit}]`,
    afterModel: {
      canJumpTo: ["end"],
      hook: (state) => {
        const latest = state.messages.at(-1);
        if (!latest || !AIMessage.isInstance(latest)) return;

        const currentCalls = (latest.tool_calls ?? []).filter((call) =>
          matchesTool(call.name, options.toolName),
        );
        if (currentCalls.length === 0) return;

        const previousCount = state.messages
          .slice(0, -1)
          .filter(
            (message) =>
              ToolMessage.isInstance(message) &&
              matchesTool(message.name, options.toolName),
          ).length;
        const remaining = Math.max(0, options.limit - previousCount);
        const blockedCalls = currentCalls.slice(remaining);
        if (blockedCalls.length === 0) return;

        const toolMessages = blockedCalls.map(
          (call, index) =>
            new ToolMessage({
              content: options.toolName
                ? `已达到 ${options.toolName} 的调用上限，请勿再次调用，继续完成剩余工作。`
                : "已达到专家工具调用上限，请根据已有结果立即结束任务。",
              tool_call_id:
                call.id ?? `history-limit-${label}-${previousCount + index}`,
              name: call.name,
              status: "error",
            }),
        );

        // continue 只补齐被阻止调用的 ToolMessage，未超限的并行调用仍可执行。
        if (options.exitBehavior === "continue" || remaining > 0) {
          return { messages: toolMessages };
        }

        // 全局限流且本轮所有工具都已超限时，补齐 tool_call 对应消息后结束
        // 当前专家，避免模型对同一个工具错误继续重试。
        return {
          messages: [
            ...toolMessages,
            new AIMessage("工具调用已达到安全上限，专家依据已有结果结束任务。"),
          ],
          jumpTo: "end" as const,
        };
      },
    },
  });
}
