/**
 * https://docs.langchain.com/oss/javascript/langchain/tools
 * Return a Command to write agent state and the matching ToolMessage.
 */
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { createAgent, tool, type ToolRuntime } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const LanguageState = z.object({
  preferredLanguage: z.string().default(""),
});

const setLanguage = tool(
  async ({ language }, runtime: ToolRuntime) => {
    return new Command({
      update: {
        preferredLanguage: language,
        messages: [
          new ToolMessage({
            content: `Language set to ${language}.`,
            tool_call_id: runtime.toolCallId,
            name: "set_language",
          }),
        ],
      },
    });
  },
  {
    name: "set_language",
    description: "Set the preferred response language. Call this once.",
    schema: z.object({ language: z.string() }),
  },
);

const agent = createAgent({
  model: docsModel(),
  tools: [setLanguage],
  stateSchema: LanguageState,
  systemPrompt:
    "Call set_language once with the language the user names, then answer in one sentence.",
});

const result = await agent.invoke(
  { messages: [{ role: "user", content: "Set my language to French." }] },
  { recursionLimit: 8 },
);

const toolMessage = result.messages.find((message) => message.type === "tool");
if (!toolMessage) {
  throw new Error(
    `Model did not call set_language. Last: ${result.messages.at(-1)?.text ?? ""}`,
  );
}
console.log(`[tool] ${toolMessage.text}`);
console.log(`[state] preferredLanguage=${result.preferredLanguage}`);
console.log(`[answer] ${result.messages.at(-1)?.text ?? ""}`);
