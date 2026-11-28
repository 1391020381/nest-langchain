/**
 * https://docs.langchain.com/oss/javascript/langchain/event-streaming
 * Multiple projections
 *
 * JavaScript has to read projections concurrently. The raw protocol iterator
 * is the run object itself. Message deltas are counted here instead of
 * printing every envelope.
 */
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";
import { repairEmptyToolNames } from "./tool-names";

const getWeather = tool(
  async ({ city }) => `It's always sunny in ${city}!`,
  {
    name: "get_weather",
    description: "Get weather for a city. Call this once.",
    schema: z.object({ city: z.string() }),
  },
);

const agent = createAgent({
  model: docsModel(),
  tools: [getWeather],
  systemPrompt: "Call get_weather once, then answer in one sentence.",
  middleware: [repairEmptyToolNames("get_weather")],
});

const input = {
  messages: [{ role: "user" as const, content: "What is the weather in SF?" }],
};
const stream = await agent.streamEvents(input, { version: "v3", recursionLimit: 8 });

const texts: string[] = [];
const calls: string[] = [];
const methods = new Map<string, number>();

await Promise.all([
  (async () => {
    for await (const message of stream.messages) {
      const text = await message.text;
      if (text.length > 0) {
        texts.push(text);
        console.log(`[message] ${text}`);
      }
    }
  })(),
  (async () => {
    for await (const call of stream.toolCalls) {
      calls.push(call.name);
      console.log(`[tool] ${call.name} ${JSON.stringify(call.input)}`);
    }
  })(),
  (async () => {
    for await (const event of stream) {
      methods.set(event.method, (methods.get(event.method) ?? 0) + 1);
    }
  })(),
]);

const summary = [...methods.entries()]
  .map(([method, count]) => `${method}=${count}`)
  .join(" ");
console.log(`[events] ${summary}`);

if (texts.length === 0 || !calls.includes("get_weather") || !methods.has("messages")) {
  throw new Error(
    `a projection was empty (messages=${texts.length}, tools=${calls.join(",") || "none"}, events=${summary || "none"})`,
  );
}
