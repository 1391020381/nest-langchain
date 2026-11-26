/**
 * https://docs.langchain.com/oss/javascript/langchain/short-term-memory
 * Threads. One MemorySaver keeps a separate checkpoint per thread_id,
 * including the custom userId on that thread.
 *
 * `stateSchema` accepts a Zod object. `new StateSchema()` needs Standard JSON
 * Schema, which this package's Zod 3.25 does not provide.
 * userId has a default so a later invoke can omit it. Initialization fills
 * only keys that are not already stored, so the checkpoint value is kept.
 */
import { MemorySaver } from "@langchain/langgraph";
import { createAgent, createMiddleware } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const ThreadState = z.object({
  userId: z.string().default(""),
});

const stateExtension = createMiddleware({
  name: "StateExtension",
  stateSchema: ThreadState,
});

const checkpointer = new MemorySaver();
const agent = createAgent({
  model: docsModel(),
  tools: [],
  systemPrompt:
    "Remember the user's name from this conversation. When asked for it, reply with only the name.",
  middleware: [stateExtension],
  checkpointer,
});

function textOf(message: { text?: string; content?: unknown }) {
  if (typeof message.text === "string" && message.text.length > 0) {
    return message.text;
  }
  return typeof message.content === "string"
    ? message.content
    : JSON.stringify(message.content ?? "");
}

function threadConfig(threadId: string) {
  return { configurable: { thread_id: threadId }, recursionLimit: 4 };
}

async function savedThread(threadId: string) {
  const tuple = await checkpointer.getTuple({ configurable: { thread_id: threadId } });
  const messages = tuple?.checkpoint.channel_values.messages;
  if (!tuple || !Array.isArray(messages)) {
    throw new Error(`no checkpoint for ${threadId}`);
  }
  return {
    id: tuple.checkpoint.id,
    userId: tuple.checkpoint.channel_values.userId,
    transcript: messages
      .map((message) => textOf(message as { text?: string; content?: unknown }))
      .join("\n"),
    count: messages.length,
  };
}

const ada = threadConfig("ada");
const lin = threadConfig("lin");

await agent.invoke(
  {
    messages: [{ role: "user", content: "My name is Ada." }],
    userId: "user_ada",
  },
  ada,
);
await agent.invoke(
  {
    messages: [{ role: "user", content: "My name is Lin." }],
    userId: "user_lin",
  },
  lin,
);

const adaRecall = await agent.invoke(
  { messages: [{ role: "user", content: "What's my name?" }] },
  ada,
);
const linRecall = await agent.invoke(
  { messages: [{ role: "user", content: "What's my name?" }] },
  lin,
);

const adaText = textOf(adaRecall.messages.at(-1) ?? {});
const linText = textOf(linRecall.messages.at(-1) ?? {});
const adaSaved = await savedThread("ada");
const linSaved = await savedThread("lin");
console.log(`[ada] ${adaText}`);
console.log(`[lin] ${linText}`);
console.log(
  `[ada checkpoint] id=${adaSaved.id} userId=${String(adaSaved.userId)} messages=${adaSaved.count}`,
);
console.log(
  `[lin checkpoint] id=${linSaved.id} userId=${String(linSaved.userId)} messages=${linSaved.count}`,
);

if (!adaText.toLowerCase().includes("ada") || adaText.toLowerCase().includes("lin")) {
  throw new Error(`thread ada recalled the wrong name: ${adaText}`);
}
if (!linText.toLowerCase().includes("lin") || linText.toLowerCase().includes("ada")) {
  throw new Error(`thread lin recalled the wrong name: ${linText}`);
}
if (adaSaved.userId !== "user_ada" || linSaved.userId !== "user_lin") {
  throw new Error("thread checkpoint did not keep its own userId");
}
if (adaSaved.transcript.includes("Lin") || linSaved.transcript.includes("Ada")) {
  throw new Error("thread checkpoint contains the other thread's messages");
}
