/**
 * https://docs.langchain.com/oss/javascript/langchain/event-streaming
 * Agent messages
 *
 * `stream.messages` yields one handle per model call. `message.text` is both
 * an async iterable of deltas and a promise of the full string. `message.output`
 * is the finalized AI message, and `message.usage` is token metadata when the
 * provider sends it.
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

const stream = await agent.streamEvents(
  { messages: [{ role: "user", content: "What is the weather in SF?" }] },
  { version: "v3", recursionLimit: 8 },
);

let calls = 0;
let answer = "";
for await (const message of stream.messages) {
  calls += 1;
  const node = message.node ?? "model";
  process.stdout.write(`[${node}] `);
  let deltas = "";
  for await (const delta of message.text) {
    deltas += delta;
    process.stdout.write(delta);
  }
  process.stdout.write("\n");

  const fullMessage = await message.output;
  console.log(`[output] ${fullMessage.text}`);
  if (fullMessage.text.length > 0) answer = fullMessage.text;

  const usage = await message.usage;
  if (usage) {
    console.log(
      `[usage] input=${usage.input_tokens} output=${usage.output_tokens} total=${usage.total_tokens}`,
    );
  } else {
    console.log("[usage] unavailable");
  }
  if (deltas.length > 0 && fullMessage.text.length === 0) {
    throw new Error(`message ${calls} streamed text but output.text was empty`);
  }
}

const finalState = await stream.output;
console.log(`[state] messages=${finalState.messages.length}`);
if (calls < 1 || answer.length === 0) {
  throw new Error(`message projection produced no answer (${calls} model calls)`);
}
