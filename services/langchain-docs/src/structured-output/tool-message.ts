/**
 * https://docs.langchain.com/oss/javascript/langchain/structured-output
 * Custom tool message content
 *
 * The page puts `toolMessageContent` on the tool message. langchain 1.6.7
 * stores the JSON arguments on the tool message and puts `toolMessageContent`
 * on the AIMessage that follows it.
 */
import { createAgent, toolStrategy } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const MeetingAction = z.object({
  task: z.string().describe("The specific task to be completed"),
  assignee: z.string().describe("Person responsible for the task"),
  priority: z.enum(["low", "medium", "high"]).describe("Priority level"),
});

const note = "Action item captured and added to meeting notes!";

const agent = createAgent({
  model: docsModel(),
  tools: [],
  responseFormat: toolStrategy(MeetingAction, {
    toolMessageContent: note,
  }),
  systemPrompt: "Call the action-item tool once.",
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "From our meeting: Sarah needs to update the project timeline as soon as possible",
    },
  ],
});

function textOf(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

for (const message of result.messages) {
  console.log(`[${message.type}] ${textOf(message.content)}`);
}
console.log(`[structured] ${JSON.stringify(result.structuredResponse)}`);

const action = result.structuredResponse;
if (!action || action.assignee !== "Sarah" || action.priority !== "high") {
  throw new Error(`unexpected action ${JSON.stringify(action)}`);
}
if (typeof action.task !== "string" || !action.task.toLowerCase().includes("timeline")) {
  throw new Error(`unexpected task ${JSON.stringify(action.task)}`);
}

const toolMessage = result.messages.find((message) => message.type === "tool");
const toolText = textOf(toolMessage?.content);
if (!toolText.includes("Sarah") || toolText === note) {
  throw new Error(`tool message was ${toolText}`);
}
const noted = result.messages.some(
  (message) => message.type === "ai" && textOf(message.content).includes(note),
);
if (!noted) {
  throw new Error("toolMessageContent was not written onto the following AIMessage");
}
