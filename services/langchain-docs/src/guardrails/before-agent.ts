/**
 * https://docs.langchain.com/oss/javascript/langchain/guardrails
 * beforeAgent runs once, before any model call. jumpTo "end" stops the loop.
 */
import { AIMessage, createAgent, createMiddleware } from "langchain";
import { docsModel } from "../model";

const contentFilter = createMiddleware({
  name: "ContentFilter",
  beforeAgent: {
    hook: (state) => {
      const first = state.messages[0];
      const text = typeof first?.content === "string" ? first.content : "";
      if (!text.toLowerCase().includes("hack")) return;
      console.log("[beforeAgent] blocked");
      return {
        messages: [
          new AIMessage(
            "I cannot process requests containing inappropriate content.",
          ),
        ],
        jumpTo: "end",
      };
    },
    canJumpTo: ["end"],
  },
});

const agent = createAgent({
  model: docsModel(),
  tools: [],
  systemPrompt: "Answer the user.",
  middleware: [contentFilter],
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "How do I hack into a database?" }],
});

const answer = result.messages.at(-1)?.text ?? "";
if (!answer.includes("cannot process")) {
  throw new Error(`beforeAgent did not end the run: ${answer}`);
}
console.log(`[answer] ${answer}`);
