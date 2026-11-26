/**
 * https://docs.langchain.com/oss/javascript/langchain/models
 * Tool calling: bindTools and run the tool loop without createAgent
 */
import type { BaseMessageLike } from "@langchain/core/messages";
import { tool } from "langchain";
import * as z from "zod";
import { docsChatModel } from "./chat-model";

const getWeather = tool(
  ({ location }) => `It's sunny in ${location}.`,
  {
    name: "get_weather",
    description: "Get the weather at a location.",
    schema: z.object({
      location: z.string().describe("The location to get the weather for"),
    }),
  },
);

const tools = [getWeather];
const toolsByName = Object.fromEntries(tools.map((item) => [item.name, item]));
const model = await docsChatModel();
const modelWithTools = model.bindTools(tools);

const messages = [
  {
    role: "user" as const,
    content:
      "What's the weather in Boston and Tokyo? Call get_weather once for each city, then answer in one sentence.",
  },
];

const aiMessage = await modelWithTools.invoke(messages);
for (const call of aiMessage.tool_calls ?? []) {
  console.log(`[call] ${call.name} ${JSON.stringify(call.args)}`);
}
if ((aiMessage.tool_calls ?? []).length === 0) {
  throw new Error(`Model returned no tool calls: ${aiMessage.text}`);
}

const history: BaseMessageLike[] = [...messages, aiMessage];
for (const call of aiMessage.tool_calls ?? []) {
  const selected = toolsByName[call.name];
  if (!selected) {
    throw new Error(`Unknown tool ${call.name}`);
  }
  const result = await selected.invoke(call);
  const text = typeof result === "string" ? result : result.text;
  console.log(`[result] ${text}`);
  history.push(result);
}

const finalResponse = await modelWithTools.invoke(history);
console.log(`[answer] ${finalResponse.text}`);
