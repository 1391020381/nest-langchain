/**
 * https://docs.langchain.com/oss/javascript/langchain/tools
 * Return a string. The agent wraps it in a ToolMessage for the model.
 */
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const getWeather = tool(({ city }) => `It is currently sunny in ${city}.`, {
  name: "get_weather",
  description: "Get weather for a city as text. Call this once.",
  schema: z.object({ city: z.string() }),
});

const agent = createAgent({
  model: docsModel(),
  tools: [getWeather],
  systemPrompt: "Call get_weather once, then answer in one sentence.",
});

const result = await agent.invoke(
  { messages: [{ role: "user", content: "Weather in Paris?" }] },
  { recursionLimit: 8 },
);

const toolMessage = result.messages.find((message) => message.type === "tool");
if (!toolMessage) {
  throw new Error(
    `Model did not call get_weather. Last: ${result.messages.at(-1)?.text ?? ""}`,
  );
}
console.log(`[tool] ${toolMessage.text}`);
console.log(`[answer] ${result.messages.at(-1)?.text ?? ""}`);
