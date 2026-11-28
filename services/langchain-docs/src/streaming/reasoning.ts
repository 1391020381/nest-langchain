/**
 * https://docs.langchain.com/oss/javascript/langchain/streaming
 * Streaming thinking / reasoning tokens
 *
 * The page filters `contentBlocks` for `type: "reasoning"`, then shows a
 * `streamEvents` v3 sample on `ChatAnthropic` with thinking enabled. This
 * run uses the configured model and the content-block filter. The v3
 * `message.reasoning` projection is `src/event-streaming/reasoning.ts`.
 * Models that do not emit reasoning still have to return text.
 */
import { AIMessageChunk } from "@langchain/core/messages";
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsChatModel, docsModelName } from "../models/chat-model";

const modelName = docsModelName();
const model = await docsChatModel({ maxTokens: 400 });
console.log(
  `[profile] reasoningOutput=${model.profile.reasoningOutput === true}`,
);

const getWeather = tool(
  async ({ city }) => `It's always sunny in ${city}!`,
  {
    name: "get_weather",
    description: "Get weather for a given city. Call this once.",
    schema: z.object({ city: z.string() }),
  },
);

const agent = createAgent({
  model,
  tools: [getWeather],
  systemPrompt: "Call get_weather once, then answer in one sentence.",
});

let text = "";
let reasoning = "";
for await (const [token] of await agent.stream(
  { messages: [{ role: "user", content: "What is the weather in SF?" }] },
  { streamMode: "messages", recursionLimit: 8 },
)) {
  if (!AIMessageChunk.isInstance(token)) continue;
  for (const block of token.contentBlocks) {
    if (block.type === "reasoning" && block.reasoning.length > 0) {
      reasoning += block.reasoning;
      process.stdout.write(`[thinking] ${block.reasoning}`);
    } else if (block.type === "text" && block.text.length > 0) {
      text += block.text;
      process.stdout.write(block.text);
    }
  }
}

console.log();
if (reasoning.length > 0) {
  console.log(`[reasoning] ${reasoning.length} chars`);
} else {
  console.log(
    `[reasoning] skip: ${modelName} returned no reasoning content blocks`,
  );
}
if (text.length === 0) {
  throw new Error("reasoning stream produced no answer text");
}
console.log(`[answer] ${text}`);
