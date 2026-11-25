/**
 * https://docs.langchain.com/oss/javascript/langchain/agents
 * Invocation
 */
import { createAgent } from "langchain";
import { Command, MemorySaver } from "@langchain/langgraph";
import { docsModel } from "../model";

const agent = createAgent({
  model: docsModel(),
  tools: [],
  systemPrompt: "Be concise. Remember the user's name.",
  checkpointer: new MemorySaver(),
});

const config = { configurable: { thread_id: "invocation" } };

function lastText(result: { messages: Array<{ content: unknown }> }) {
  const content = result.messages.at(-1)?.content;
  return typeof content === "string" ? content : JSON.stringify(content);
}

let result = await agent.invoke(
  {
    messages: [{ role: "user", content: "My name is Ada." }],
  },
  config,
);
console.log(`[invoke] ${lastText(result)}`);

result = await agent.invoke(
  { messages: [{ role: "user", content: "What's my name?" }] },
  config,
);
console.log(`[thread] ${lastText(result)}`);

result = await agent.invoke(
  new Command({
    update: {
      messages: [{ role: "user", content: "Repeat only my name." }],
    },
    goto: "model_request",
  }) as never, // two installed copies of @langchain/langgraph; Command types do not match
  config,
);
console.log(`[command] ${lastText(result)}`);
console.log(
  `[history] ${result.messages.map((message) => message.type).join(" -> ")}`,
);
