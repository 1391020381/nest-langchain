/**
 * https://docs.langchain.com/oss/javascript/langchain/tools
 * Turn a thrown tool error into a ToolMessage with wrapToolCall.
 */
import { createAgent, createMiddleware, tool, ToolMessage } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const lookupOrder = tool(
  ({ order_id }) => {
    throw new Error(`inventory offline for ${order_id}`);
  },
  {
    name: "lookup_order",
    description: "Look up an order. Call this once.",
    schema: z.object({
      order_id: z.string(),
    }),
  },
);

const handleToolErrors = createMiddleware({
  name: "HandleToolErrors",
  wrapToolCall: async (request, handler) => {
    try {
      return await handler(request);
    } catch (error) {
      const toolCallId = request.toolCall.id;
      if (!toolCallId) throw error;
      console.log(`[caught] ${error instanceof Error ? error.message : String(error)}`);
      return new ToolMessage({
        content: `Tool error: Please check your input and try again. (${error})`,
        tool_call_id: toolCallId,
        status: "error",
      });
    }
  },
});

const agent = createAgent({
  model: docsModel(),
  tools: [lookupOrder],
  middleware: [handleToolErrors],
  systemPrompt:
    "Call lookup_order once. If the tool result is an error, tell the user the lookup failed and quote the error. Do not call the tool again.",
});

const result = await agent.invoke(
  {
    messages: [{ role: "user", content: "Look up order 12345." }],
  },
  { recursionLimit: 8 },
);

const toolMessage = result.messages.find((message) => message.type === "tool");
const toolText = toolMessage?.text ?? "";
console.log(`[tool] ${toolText}`);
if (!toolText.includes("Tool error")) {
  throw new Error("wrapToolCall did not replace the thrown error with a ToolMessage");
}
console.log(`[answer] ${result.messages.at(-1)?.text ?? ""}`);
