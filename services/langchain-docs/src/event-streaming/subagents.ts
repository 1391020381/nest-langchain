/**
 * https://docs.langchain.com/oss/javascript/langchain/event-streaming
 * Streaming sub-agents
 *
 * A named `createAgent` invoked inside a tool shows up on `stream.subagents`.
 * The page returns `result.messages.at(-1)?.text`. The parent tool config is
 * forwarded so the inner run stays on this stream. `lc_agent_name` is set
 * again on that call: the parent config already carries the supervisor name,
 * and the nested tasks would otherwise be labeled `supervisor`.
 */
import { createAgent, tool, type ToolRuntime } from "langchain";
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

const weatherAgent = createAgent({
  model: docsModel(),
  tools: [getWeather],
  name: "weather_agent",
  systemPrompt: "Call get_weather once, then answer in one sentence.",
  middleware: [repairEmptyToolNames("get_weather")],
});

const callWeather = tool(
  async ({ query }, runtime: ToolRuntime) => {
    const result = await weatherAgent.invoke(
      { messages: [{ role: "user", content: query }] },
      {
        ...runtime.config,
        metadata: {
          ...runtime.metadata,
          lc_agent_name: "weather_agent",
        },
      },
    );
    return result.messages.at(-1)?.text ?? "";
  },
  {
    name: "call_weather",
    description: "Ask the weather agent. Call this once.",
    schema: z.object({ query: z.string() }),
  },
);

const supervisor = createAgent({
  model: docsModel(),
  tools: [callWeather],
  name: "supervisor",
  systemPrompt: "Call call_weather once with the user's question, then stop.",
  middleware: [repairEmptyToolNames("call_weather")],
});

const stream = await supervisor.streamEvents(
  { messages: [{ role: "user", content: "What's the weather in Boston?" }] },
  { version: "v3", recursionLimit: 25 },
);

const names: string[] = [];
await Promise.all([
  (async () => {
    for await (const subagent of stream.subagents) {
      names.push(subagent.name);
      const cause = subagent.cause ? JSON.stringify(subagent.cause) : "none";
      process.stdout.write(`\n[${subagent.name}] cause=${cause}\n`);
      for await (const message of subagent.messages) {
        for await (const token of message.text) {
          process.stdout.write(token);
        }
      }
    }
  })(),
  stream.output.then((state) => {
    console.log(`\n[supervisor] ${state.messages.at(-1)?.text ?? ""}`);
  }),
]);

if (!names.includes("weather_agent")) {
  throw new Error(
    `named subagent was not streamed (saw: ${names.join(", ") || "none"})`,
  );
}
