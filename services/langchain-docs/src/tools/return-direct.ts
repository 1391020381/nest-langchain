/**
 * https://docs.langchain.com/oss/javascript/langchain/tools
 * returnDirect stops the agent after the tool message.
 *
 * This only happens when every tool call in that step sets returnDirect.
 * A mixed batch is sent back to the model.
 */
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const fetchOrderStatus = tool(
  ({ order_id }) => `Order ${order_id} is shipped and will arrive in 2 days.`,
  {
    name: "fetch_order_status",
    description: "Fetch the current status of a customer order.",
    schema: z.object({ order_id: z.string() }),
    returnDirect: true,
  },
);

const agent = createAgent({
  model: docsModel(),
  tools: [fetchOrderStatus],
  systemPrompt: "Call fetch_order_status once.",
});

const result = await agent.invoke(
  {
    messages: [{ role: "user", content: "What is the status of order 12345?" }],
  },
  { recursionLimit: 8 },
);

const toolMessage = result.messages.find((message) => message.type === "tool");
if (!toolMessage) {
  throw new Error(
    `Model did not call fetch_order_status. Last: ${result.messages.at(-1)?.text ?? ""}`,
  );
}
console.log(
  `[history] ${result.messages.map((message) => message.type).join(" -> ")}`,
);
console.log(`[tool] ${toolMessage.text}`);
if (result.messages.at(-1)?.type !== "tool") {
  throw new Error(
    "returnDirect should stop on the tool message, without another model call.",
  );
}
