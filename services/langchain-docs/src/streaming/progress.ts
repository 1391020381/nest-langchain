/**
 * https://docs.langchain.com/oss/javascript/langchain/streaming
 * Agent progress
 *
 * The section text and the stream-mode table use `streamMode: "updates"`.
 * The code sample currently pasted under that heading is `streamEvents`
 * version "v3"; those projections live in `src/event-streaming`.
 * `thread_id` still requires a checkpointer. The page imports `uuid7` from
 * `langsmith`; this run uses `randomUUID` so the example has no extra dependency.
 */
import { MemorySaver } from "@langchain/langgraph";
import { createAgent, tool } from "langchain";
import { randomUUID } from "node:crypto";
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

const checkpointer = new MemorySaver();
const agent = createAgent({
  model: docsModel(),
  tools: [getWeather],
  systemPrompt: "Call get_weather once, then answer in one sentence.",
  checkpointer,
});

const threadId = randomUUID();
const config = { configurable: { thread_id: threadId }, recursionLimit: 8 };

function summarizeUpdate(chunk: unknown): string {
  if (!chunk || typeof chunk !== "object") return String(chunk);
  return Object.entries(chunk as Record<string, unknown>)
    .map(([node, update]) => {
      const messages =
        update && typeof update === "object" && "messages" in update
          ? (update as { messages: unknown }).messages
          : undefined;
      if (!Array.isArray(messages)) return node;
      const kinds = messages.map((message) => {
        if (!message || typeof message !== "object") return "?";
        const typed = message as {
          type?: string;
          name?: string;
          tool_calls?: Array<{ name?: string }>;
        };
        const calls = typed.tool_calls?.map((call) => call.name).filter(Boolean);
        if (calls && calls.length > 0) return `ai:${calls.join(",")}`;
        if (typed.type === "tool") return `tool:${typed.name ?? ""}`;
        return typed.type ?? "message";
      });
      return `${node}[${kinds.join(", ")}]`;
    })
    .join(" ");
}

console.log(`== updates ==\n[thread] ${threadId}`);
const steps: string[] = [];
for await (const chunk of await agent.stream(
  { messages: [{ role: "user", content: "what is the weather in sf" }] },
  { ...config, streamMode: "updates" },
)) {
  const line = summarizeUpdate(chunk);
  steps.push(line);
  console.log(`[update] ${line}`);
}

const tuple = await checkpointer.getTuple({ configurable: { thread_id: threadId } });
const stored = tuple?.checkpoint.channel_values.messages;
const storedCount = Array.isArray(stored) ? stored.length : 0;
console.log(`[checkpoint] messages=${storedCount}`);

const trace = steps.join(" | ");
if (steps.length < 2 || !/tool|get_weather/.test(trace) || storedCount < 2) {
  throw new Error(
    `updates stream did not record the tool step (${steps.length} steps, stored ${storedCount})`,
  );
}
