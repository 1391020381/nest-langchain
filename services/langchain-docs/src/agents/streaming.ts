/**
 * https://docs.langchain.com/oss/javascript/langchain/agents
 * Streaming
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

const messages = [
  { role: "user" as const, content: "what is the weather in sf" },
];

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "content" in value) {
    const content = value.content;
    return typeof content === "string" ? content : JSON.stringify(content);
  }
  return JSON.stringify(value);
}

console.log("== stream ==");
for await (const [token, metadata] of await agent.stream(
  { messages },
  { streamMode: "messages" },
)) {
  if (AIMessageChunk.isInstance(token)) {
    if (typeof token.content === "string" && token.content.length > 0) {
      process.stdout.write(token.content);
    }
    for (const call of token.tool_call_chunks ?? []) {
      if (call.name) {
        console.log(`\n[tool] ${metadata.langgraph_node} ${call.name}`);
      }
    }
  }
}

console.log("\n\n== streamEvents ==");
// The agents page uses version "v3". With this model those tool-call chunks
// have empty names and the run hits the recursion limit, so this uses "v2".
const events = await agent.streamEvents({ messages }, { version: "v2" });
for await (const event of events) {
  if (event.event === "on_chat_model_stream") {
    const content = event.data.chunk?.content;
    if (typeof content === "string" && content.length > 0) {
      process.stdout.write(content);
    }
  } else if (event.event === "on_tool_start") {
    console.log(`\n[tool] ${event.name} ${JSON.stringify(event.data.input)}`);
  } else if (event.event === "on_tool_end") {
    console.log(`[tool result] ${textOf(event.data.output)}`);
  }
}
console.log();
