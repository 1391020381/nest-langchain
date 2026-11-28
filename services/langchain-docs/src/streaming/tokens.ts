/**
 * https://docs.langchain.com/oss/javascript/langchain/streaming
 * LLM tokens
 *
 * `streamMode: "messages"` yields `(token, metadata)` tuples. Empty chunks
 * are skipped; the page prints every `contentBlocks` payload.
 */
import { AIMessageChunk } from "@langchain/core/messages";
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const getWeather = tool(
  ({ city }) => `The weather in ${city} is always sunny!`,
  {
    name: "get_weather",
    description: "Get weather for a given city. Call this once.",
    schema: z.object({
      city: z.string(),
    }),
  },
);

const agent = createAgent({
  model: docsModel(),
  tools: [getWeather],
  systemPrompt: "Call get_weather once, then answer in one sentence.",
});

let text = "";
let sawTool = false;
for await (const [token, metadata] of await agent.stream(
  { messages: [{ role: "user", content: "what is the weather in sf" }] },
  { streamMode: "messages", recursionLimit: 8 },
)) {
  if (!AIMessageChunk.isInstance(token)) continue;
  const parts: string[] = [];
  for (const block of token.contentBlocks) {
    if (block.type === "text" && block.text.length > 0) {
      parts.push(block.text);
    } else if (block.type === "tool_call" && block.name) {
      sawTool = true;
      parts.push(`[tool_call] ${block.name}`);
    } else if (block.type === "reasoning" && block.reasoning.length > 0) {
      parts.push(`[reasoning] ${block.reasoning}`);
    }
  }
  for (const call of token.tool_call_chunks ?? []) {
    if (call.name) {
      sawTool = true;
      parts.push(`[tool_call] ${call.name}`);
    }
  }
  if (
    parts.length === 0 &&
    typeof token.content === "string" &&
    token.content.length > 0
  ) {
    parts.push(token.content);
  }
  if (parts.length === 0) continue;
  const line = parts.join("");
  text += line;
  console.log(`[${metadata.langgraph_node}] ${line}`);
}

if (!sawTool || text.length === 0) {
  throw new Error(
    `message stream missed the tool call or the text (tool=${sawTool}, text=${text.length})`,
  );
}
