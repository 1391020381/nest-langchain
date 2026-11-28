/**
 * https://docs.langchain.com/oss/javascript/langchain/multi-agent/router
 * A routing step classifies the input, then one specialist agent runs.
 * This classifier is a rule, so the routing decision does not spend a model call.
 */
import { createAgent } from "langchain";
import { docsModel } from "../model";

const weather = createAgent({
  model: docsModel(),
  tools: [],
  name: "weather",
  systemPrompt: "You answer weather questions. Reply in one sentence.",
});

const billing = createAgent({
  model: docsModel(),
  tools: [],
  name: "billing",
  systemPrompt: "You answer billing questions. Reply in one sentence.",
});

function classify(query: string) {
  return /invoice|账单|bill/i.test(query) ? "billing" : "weather";
}

const query = "What is the weather in Paris?";
const route = classify(query);
const agent = route === "billing" ? billing : weather;
console.log(`[route] ${route}`);

const result = await agent.invoke({
  messages: [{ role: "user", content: query }],
});

const answer = result.messages.at(-1)?.text ?? "";
if (!answer) {
  throw new Error("specialist returned an empty answer");
}
console.log(`[answer] ${answer}`);
