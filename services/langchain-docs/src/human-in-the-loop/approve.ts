/**
 * https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop
 * humanInTheLoopMiddleware pauses send_email until a person approves it.
 *
 * The pause is a checkpoint, so createAgent needs a checkpointer. Resume
 * with Command({ resume }) on the same thread_id.
 */
import { Command, MemorySaver } from "@langchain/langgraph";
import { createAgent, humanInTheLoopMiddleware, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const sendEmail = tool(
  ({ to }) => `Sent the note to ${to}.`,
  {
    name: "send_email",
    description: "Send a short email. Call this once.",
    schema: z.object({ to: z.string() }),
  },
);

const agent = createAgent({
  model: docsModel(),
  tools: [sendEmail],
  systemPrompt: "Call send_email once with the address in the user message, then stop.",
  checkpointer: new MemorySaver(),
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: {
        send_email: { allowedDecisions: ["approve", "reject"] },
      },
    }),
  ],
});

const config = { configurable: { thread_id: "hitl-approve" }, recursionLimit: 8 };

type HitlPause = {
  __interrupt__?: Array<{ value?: { actionRequests?: Array<{ name?: string }> } }>;
  messages: Array<{ type: string; text?: string }>;
};

const paused = (await agent.invoke(
  { messages: [{ role: "user", content: "Email ada@example.com that the report is ready." }] },
  config,
)) as HitlPause;

const action = paused.__interrupt__?.[0]?.value?.actionRequests?.[0]?.name;
console.log(`[paused] ${action ?? "none"}`);
if (action !== "send_email") {
  throw new Error("send_email did not pause for review");
}

const resumed = (await agent.invoke(
  new Command({ resume: { decisions: [{ type: "approve" }] } }) as never,
  config,
)) as HitlPause;

const toolMessage = resumed.messages.find((message) => message.type === "tool");
if (!toolMessage?.text) {
  throw new Error("send_email did not run after approve");
}
console.log(`[tool] ${toolMessage.text}`);
console.log(`[answer] ${resumed.messages.at(-1)?.text ?? ""}`);
