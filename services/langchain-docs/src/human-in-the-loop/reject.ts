/**
 * https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop
 * reject skips the tool and sends the human's message back to the model.
 */
import { Command, MemorySaver } from "@langchain/langgraph";
import { createAgent, humanInTheLoopMiddleware, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

let ran = false;

const sendEmail = tool(
  ({ to }) => {
    ran = true;
    return `Sent the note to ${to}.`;
  },
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

const config = { configurable: { thread_id: "hitl-reject" }, recursionLimit: 8 };

type HitlPause = {
  __interrupt__?: Array<{ value?: { actionRequests?: Array<{ name?: string }> } }>;
  messages: Array<{ type: string; text?: string }>;
};

const paused = (await agent.invoke(
  { messages: [{ role: "user", content: "Email ada@example.com that the report is ready." }] },
  config,
)) as HitlPause;

if (paused.__interrupt__?.[0]?.value?.actionRequests?.[0]?.name !== "send_email") {
  throw new Error("send_email did not pause for review");
}
console.log("[paused] send_email");

const resumed = (await agent.invoke(
  new Command({
    resume: { decisions: [{ type: "reject", message: "Do not email the customer." }] },
  }) as never,
  config,
)) as HitlPause;

if (ran) {
  throw new Error("send_email ran after reject");
}
console.log(`[answer] ${resumed.messages.at(-1)?.text ?? ""}`);
