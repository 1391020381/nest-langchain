/**
 * https://docs.langchain.com/oss/javascript/langchain/multi-agent/subagents
 * A named agent is a tool of another named agent. name identifies the child
 * when this run is later embedded in a parent graph or a stream.
 *
 * The first model step sets toolChoice to "required". Without that, the
 * configured model answers the question itself and never calls the child.
 */
import { createAgent, createMiddleware, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const researcher = createAgent({
  model: docsModel(),
  tools: [],
  name: "researcher",
  systemPrompt: "Answer in one short sentence.",
});

const askResearcher = tool(
  async ({ question }) => {
    console.log("[child] researcher");
    const result = await researcher.invoke({
      messages: [{ role: "user", content: question }],
    });
    return result.messages.at(-1)?.text ?? "";
  },
  {
    name: "ask_researcher",
    description: "Ask the researcher one question. Call this once.",
    schema: z.object({ question: z.string() }),
  },
);

const requireOneCall = createMiddleware({
  name: "RequireOneCall",
  wrapModelCall: (request, handler) => {
    const called = request.messages.some((message) => message.type === "tool");
    return handler({ ...request, toolChoice: called ? "auto" : "required" });
  },
});

const lead = createAgent({
  model: docsModel(),
  tools: [askResearcher],
  name: "lead",
  systemPrompt: "Call ask_researcher once with the user's question, then repeat the answer.",
  middleware: [requireOneCall],
});

const result = await lead.invoke(
  { messages: [{ role: "user", content: "What is an agent harness in one sentence?" }] },
  { recursionLimit: 8 },
);

const toolMessage = result.messages.find((message) => message.type === "tool");
if (!toolMessage?.text) {
  throw new Error("lead did not call ask_researcher");
}
console.log(`[tool] ${toolMessage.text}`);
console.log(`[answer] ${result.messages.at(-1)?.text ?? ""}`);
