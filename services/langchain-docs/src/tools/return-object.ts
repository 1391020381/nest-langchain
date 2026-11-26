/**
 * https://docs.langchain.com/oss/javascript/langchain/tools
 * Return an object. The agent serializes it into the ToolMessage content.
 */
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const getWeatherData = tool(
  ({ city }) => ({
    city,
    temperature_c: 22,
    conditions: "sunny",
  }),
  {
    name: "get_weather_data",
    description: "Get structured weather data for a city. Call this once.",
    schema: z.object({ city: z.string() }),
  },
);

const agent = createAgent({
  model: docsModel(),
  tools: [getWeatherData],
  systemPrompt: "Call get_weather_data once, then answer in one sentence.",
});

const result = await agent.invoke(
  { messages: [{ role: "user", content: "Weather in Paris?" }] },
  { recursionLimit: 8 },
);

const toolMessage = result.messages.find((message) => message.type === "tool");
if (!toolMessage) {
  throw new Error(
    `Model did not call get_weather_data. Last: ${result.messages.at(-1)?.text ?? ""}`,
  );
}
console.log(`[tool] ${toolMessage.text}`);
console.log(`[answer] ${result.messages.at(-1)?.text ?? ""}`);
