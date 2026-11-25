/**
 * https://docs.langchain.com/oss/javascript/langchain/agents
 * Structured output
 */
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const search = tool(
  ({ query }) =>
    `Results for: ${query}\n- Models are getting better at tool calling.\n- Agents pair a model with tools and a control loop.\n- Structured output returns a validated object instead of free text.`,
  {
    name: "search",
    description: "Search for information. Call this once, then answer.",
    schema: z.object({ query: z.string() }),
  },
);

const Answer = z.object({
  summary: z.string(),
  confidence: z.number(),
});

const agent = createAgent({
  model: docsModel(),
  tools: [search],
  responseFormat: Answer,
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "Summarize AI trends" }],
});

console.log(result.structuredResponse);
