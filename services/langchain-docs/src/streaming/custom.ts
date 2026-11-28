/**
 * https://docs.langchain.com/oss/javascript/langchain/streaming
 * Custom updates
 *
 * The page types the tool's second argument as `LangGraphRunnableConfig`.
 * That config's `writer` is the same function `ToolRuntime.writer` exposes.
 * Writer output is only emitted when `streamMode` includes `"custom"`.
 */
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

const lines: string[] = [];
for await (const chunk of await agent.stream(
  { messages: [{ role: "user", content: "what is the weather in sf" }] },
  { streamMode: "custom", recursionLimit: 8 },
)) {
  const line = typeof chunk === "string" ? chunk : JSON.stringify(chunk);
  lines.push(line);
  console.log(line);
}

const lookedUp = lines.some((line) => line.startsWith("Looking up data for city:"));
const acquired = lines.some((line) => line.startsWith("Acquired data for city:"));
if (!lookedUp || !acquired) {
  throw new Error(`custom stream missed a writer update (${lines.join(" | ")})`);
}
