/**
 * https://docs.langchain.com/oss/javascript/langchain/event-streaming
 * Tool calls
 *
 * `message.toolCalls` streams argument chunks while the model is producing
 * the call. `stream.toolCalls` is the execution lifecycle after the call
 * starts. The page reads both at the same time with `Promise.all`.
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

const chunkNames: string[] = [];
const calls: string[] = [];

await Promise.all([
  (async () => {
    for await (const message of stream.messages) {
      for await (const chunk of message.toolCalls) {
        chunkNames.push(chunk.name);
        console.log(
          `[chunk] ${chunk.name} ${JSON.stringify(chunk.args ?? chunk).slice(0, 180)}`,
        );
      }
    }
  })(),
  (async () => {
    for await (const call of stream.toolCalls) {
      calls.push(call.name);
      const output = await call.output;
      const error = await call.error;
      const text =
        typeof output === "string"
          ? output
          : output && typeof output === "object" && "text" in output
            ? String((output as { text: unknown }).text)
            : JSON.stringify(output);
      console.log(`[call] ${call.name} ${JSON.stringify(call.input)}`);
      console.log(`[result] ${text}${error ? ` error=${error}` : ""}`);
    }
  })(),
]);

if (!calls.includes("get_weather")) {
  throw new Error(
    `tool-call projection missed get_weather (chunks=${chunkNames.join(",") || "none"}, calls=${calls.join(",") || "none"})`,
  );
}
