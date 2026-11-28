/**
 * https://docs.langchain.com/oss/javascript/langchain/guardrails
 * piiMiddleware redacts an email before the model sees the user message.
 *
 * beforeModel hooks run in middleware array order, so the observer runs
 * after PIIMiddleware and records the text the model will receive.
 */
import { createAgent, createMiddleware, piiMiddleware } from "langchain";
import { docsModel } from "../model";

const email = "ada@example.com";
let seenByModel = "";

const observeInput = createMiddleware({
  name: "ObserveInput",
  beforeModel: (state) => {
    const human = [...state.messages].reverse().find((message) => message.type === "human");
    seenByModel = typeof human?.content === "string" ? human.content : JSON.stringify(human?.content ?? "");
    console.log(`[model sees] ${seenByModel}`);
  },
});

const agent = createAgent({
  model: docsModel(),
  tools: [],
  systemPrompt: "Reply with the single word: ok",
  middleware: [
    piiMiddleware("email", { strategy: "redact", applyToInput: true }),
    observeInput,
  ],
});

const result = await agent.invoke({
  messages: [{ role: "user", content: `My email is ${email}. Acknowledge it.` }],
});

if (!seenByModel.includes("[REDACTED_EMAIL]") || seenByModel.includes(email)) {
  throw new Error(`Email was not redacted before the model call: ${seenByModel}`);
}
console.log(`[answer] ${result.messages.at(-1)?.text ?? ""}`);
