/**
 * https://docs.langchain.com/oss/javascript/langchain/multi-agent/skills
 * One agent stays in control and loads a skill as a tool result.
 * The skill text is the specialist prompt, not a second agent.
 */
import { createAgent, createMiddleware, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const REFUND_SKILL = "Refund policy: refunds are accepted within 30 days.";

const loadRefundSkill = tool(() => REFUND_SKILL, {
  name: "load_refund_skill",
  description: "Load the refund policy. Call this once before answering a refund question.",
  schema: z.object({}),
});

const requireSkill = createMiddleware({
  name: "RequireSkill",
  wrapModelCall: (request, handler) => {
    const called = request.messages.some((message) => message.type === "tool");
    return handler({ ...request, toolChoice: called ? "auto" : "required" });
  },
});

const agent = createAgent({
  model: docsModel(),
  tools: [loadRefundSkill],
  name: "clerk",
  systemPrompt: "Call load_refund_skill once, then answer from that policy in one sentence.",
  middleware: [requireSkill],
});

const result = await agent.invoke(
  { messages: [{ role: "user", content: "Can I return a purchase?" }] },
  { recursionLimit: 8 },
);

const toolMessage = result.messages.find((message) => message.type === "tool");
if (!toolMessage?.text?.includes("30 days")) {
  throw new Error("refund skill was not loaded");
}
console.log(`[skill] ${toolMessage.text}`);
console.log(`[answer] ${result.messages.at(-1)?.text ?? ""}`);
