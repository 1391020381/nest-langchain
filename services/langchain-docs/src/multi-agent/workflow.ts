/**
 * https://docs.langchain.com/oss/javascript/langchain/multi-agent/custom-workflow
 * A deterministic step runs before the agent. The agent only sees the city
 * that step extracted.
 */
import { createAgent, createMiddleware, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

function extractCity(text: string) {
  const match = text.match(/\bin\s+([A-Za-z]+)/);
  return match?.[1] ?? "Paris";
}

const question = "What is the weather in Paris tomorrow?";
const city = extractCity(question);
console.log(`[extract] ${city}`);
if (city !== "Paris") {
  throw new Error(`expected Paris, got ${city}`);
}

let lookedUp = "";

const getWeather = tool(
  ({ city: requested }) => {
    lookedUp = requested;
    return `It is sunny in ${requested}.`;
  },
  {
    name: "get_weather",
    description: "Get the weather for a city. Call this once.",
    schema: z.object({ city: z.string() }),
  },
);

const requireTool = createMiddleware({
  name: "RequireTool",
  wrapModelCall: (request, handler) => {
    const called = request.messages.some((message) => message.type === "tool");
    return handler({ ...request, toolChoice: called ? "auto" : "required" });
  },
});

const agent = createAgent({
  model: docsModel(),
  tools: [getWeather],
  systemPrompt: "Call get_weather once with the city in the user message, then answer in one sentence.",
  middleware: [requireTool],
});

const result = await agent.invoke(
  { messages: [{ role: "user", content: `Weather in ${city}?` }] },
  { recursionLimit: 8 },
);

if (lookedUp !== "Paris") {
  throw new Error(`workflow did not look up Paris: ${lookedUp || "no tool call"}`);
}
console.log(`[tool] ${lookedUp}`);
console.log(`[answer] ${result.messages.at(-1)?.text ?? ""}`);
