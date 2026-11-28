/**
 * https://docs.langchain.com/oss/javascript/langchain/event-streaming
 * State and final output
 *
 * `stream.values` yields state snapshots. `stream.output` is the final state.
 * Snapshots are logged as message counts; the page prints the whole object.
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
  systemPrompt: "You must call get_weather exactly once before answering. Do not answer from memory.",
  middleware: [repairEmptyToolNames("get_weather")],
});

const stream = await agent.streamEvents(
  { messages: [{ role: "user", content: "What is the weather in SF?" }] },
  { version: "v3", recursionLimit: 8 },
);

let snapshots = 0;
for await (const snapshot of stream.values) {
  snapshots += 1;
  const count = Array.isArray(snapshot.messages) ? snapshot.messages.length : 0;
  console.log(`[values] messages=${count}`);
}

const finalState = await stream.output;
const answer = finalState.messages.at(-1)?.text ?? "";
const sawTool = finalState.messages.some((message) => message.type === "tool");
console.log(`[output] messages=${finalState.messages.length} ${answer}`);

if (snapshots < 2 || !sawTool || answer.length === 0) {
  throw new Error(
    `state projection missed the tool step (snapshots=${snapshots}, tool=${sawTool}, messages=${finalState.messages.length})`,
  );
}
