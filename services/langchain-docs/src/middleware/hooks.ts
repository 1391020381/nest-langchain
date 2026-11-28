/**
 * https://docs.langchain.com/oss/javascript/langchain/middleware/overview
 * beforeModel、afterModel 和 wrapToolCall 挂在同一条循环上。
 */
import { createAgent, createMiddleware, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const steps: string[] = [];

const traceLoop = createMiddleware({
  name: "TraceLoop",
  beforeModel: (state) => {
    steps.push(`beforeModel:${state.messages.length}`);
    console.log(`[beforeModel] messages=${state.messages.length}`);
  },
  afterModel: (state) => {
    const last = state.messages.at(-1);
    steps.push(`afterModel:${last?.type ?? "none"}`);
    console.log(`[afterModel] ${last?.type ?? "none"}`);
  },
  wrapToolCall: async (request, handler) => {
    steps.push(`tool:${request.toolCall.name}`);
    console.log(`[tool] ${request.toolCall.name}`);
    return handler(request);
  },
});

const getWeather = tool(({ city }) => `It is sunny in ${city}.`, {
  name: "get_weather",
  description: "Get the weather for a city. Call this once.",
  schema: z.object({ city: z.string() }),
});

const agent = createAgent({
  model: docsModel(),
  tools: [getWeather],
  systemPrompt: "Call get_weather once, then answer in one sentence.",
  middleware: [traceLoop],
});

const result = await agent.invoke(
  { messages: [{ role: "user", content: "Weather in Paris?" }] },
  { recursionLimit: 8 },
);

if (!steps.some((step) => step.startsWith("tool:"))) {
  throw new Error(
    `Model did not call get_weather. Steps: ${steps.join(" ")}`,
  );
}
console.log(`[answer] ${result.messages.at(-1)?.text ?? ""}`);
console.log(`[steps] ${steps.join(" -> ")}`);
