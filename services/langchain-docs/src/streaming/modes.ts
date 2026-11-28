/**
 * https://docs.langchain.com/oss/javascript/langchain/streaming
 * Stream multiple modes
 *
 * An array `streamMode` yields `[mode, chunk]` tuples. Message chunks are
 * printed as text instead of the page's full `JSON.stringify`, which dumps
 * every token object.
 */
import { AIMessageChunk } from "@langchain/core/messages";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const getWeather = tool(
  async (input, config: LangGraphRunnableConfig) => {
    config.writer?.(`Looking up data for city: ${input.city}`);
    config.writer?.(`Acquired data for city: ${input.city}`);
    return `It's always sunny in ${input.city}!`;
  },
  {
    name: "get_weather",
    description: "Get weather for a given city. Call this once.",
    schema: z.object({
      city: z.string().describe("The city to get weather for."),
    }),
  },
);

const agent = createAgent({
  model: docsModel(),
  tools: [getWeather],
  systemPrompt: "Call get_weather once, then answer in one sentence.",
});

function streamEvent(event: unknown): { mode: string; chunk: unknown } | undefined {
  if (!Array.isArray(event)) return undefined;
  if (typeof event[0] === "string") return { mode: event[0], chunk: event[1] };
  if (Array.isArray(event[0]) && typeof event[1] === "string") {
    return { mode: event[1], chunk: event[2] };
  }
  return undefined;
}

function messageText(chunk: unknown): string {
  const token = Array.isArray(chunk) ? chunk[0] : chunk;
  if (!AIMessageChunk.isInstance(token)) return "";
  const blocks = token.contentBlocks
    .filter((block) => block.type === "text" && block.text.length > 0)
    .map((block) => block.text)
    .join("");
  if (blocks.length > 0) return blocks;
  return typeof token.content === "string" ? token.content : "";
}

function summarizeUpdate(chunk: unknown): string {
  if (!chunk || typeof chunk !== "object") return String(chunk);
  return Object.keys(chunk as Record<string, unknown>).join(",");
}

const seen = new Set<string>();
const custom: string[] = [];
let text = "";
for await (const event of await agent.stream(
  { messages: [{ role: "user", content: "what is the weather in sf" }] },
  { streamMode: ["updates", "messages", "custom"], recursionLimit: 8 },
)) {
  const parsed = streamEvent(event);
  if (!parsed) continue;
  seen.add(parsed.mode);
  if (parsed.mode === "custom") {
    const line = typeof parsed.chunk === "string" ? parsed.chunk : JSON.stringify(parsed.chunk);
    custom.push(line);
    console.log(`[custom] ${line}`);
  } else if (parsed.mode === "updates") {
    console.log(`[updates] ${summarizeUpdate(parsed.chunk)}`);
  } else if (parsed.mode === "messages") {
    const delta = messageText(parsed.chunk);
    if (delta.length > 0) {
      text += delta;
      process.stdout.write(delta);
    }
  }
}

console.log();
const missing = ["updates", "messages", "custom"].filter((mode) => !seen.has(mode));
const lookedUp = custom.some((line) => line.startsWith("Looking up data for city:"));
if (missing.length > 0 || !lookedUp || text.length === 0) {
  throw new Error(
    `combined stream missed a mode or the writer text (missing=${missing.join(",") || "none"}, custom=${custom.length}, text=${text.length})`,
  );
}
