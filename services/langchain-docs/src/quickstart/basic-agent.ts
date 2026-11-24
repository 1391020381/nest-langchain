/**
 * https://docs.langchain.com/oss/javascript/langchain/quickstart
 * Build a basic agent
 */
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const getWeather = tool(
  (input) => `It's always sunny in ${input.city}!`,
  {
    name: "get_weather",
    description: "Get the weather for a given city",
    schema: z.object({
      city: z.string().describe("The city to get the weather for"),
    }),
  },
);

const agent = createAgent({
  model: docsModel(),
  tools: [getWeather],
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What's the weather in San Francisco?" }],
});

for (const message of result.messages) {
  const text =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);
  console.log(`[${message.type}] ${text}`);
}
