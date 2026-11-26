/**
 * https://docs.langchain.com/oss/javascript/langchain/short-term-memory
 * Usage — checkpointer
 *
 * MemorySaver keeps the thread in process memory. A database-backed saver
 * such as PostgresSaver is the production equivalent; it lives in its own
 * package and needs a running database, so this script does not open one.
 * createAgent types getState as internal, so the saved thread is read from
 * the checkpointer.
 */
import { MemorySaver } from "@langchain/langgraph";
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const getUserInfo = tool(() => "No user profile on file.", {
  name: "get_user_info",
  description: "Look up a stored user profile. There is no profile on file.",
  schema: z.object({}),
});

const checkpointer = new MemorySaver();
const agent = createAgent({
  model: docsModel(),
  tools: [getUserInfo],
  systemPrompt:
    "Do not call tools. Remember the user's name from this conversation. When asked for it, reply with only the name.",
  checkpointer,
});

const thread = { configurable: { thread_id: "bob" }, recursionLimit: 6 };

function textOf(message: { text?: string; content?: unknown }) {
  if (typeof message.text === "string" && message.text.length > 0) {
    return message.text;
  }
  return typeof message.content === "string"
    ? message.content
    : JSON.stringify(message.content ?? "");
}

let result = await agent.invoke(
  { messages: [{ role: "user", content: "Hi! My name is Bob." }] },
  thread,
);
console.log(`[invoke] ${textOf(result.messages.at(-1) ?? {})}`);

result = await agent.invoke(
  { messages: [{ role: "user", content: "What's my name?" }] },
  thread,
);
const recall = textOf(result.messages.at(-1) ?? {});
console.log(`[recall] ${recall}`);

const saved = await checkpointer.getTuple({ configurable: { thread_id: "bob" } });
const messages = saved?.checkpoint.channel_values.messages;
if (!saved || !Array.isArray(messages)) {
  throw new Error("checkpointer has no message history for this thread");
}
const transcript = messages
  .map((message) => textOf(message as { text?: string; content?: unknown }))
  .join("\n");
console.log(`[checkpoint] id=${saved.checkpoint.id} messages=${messages.length}`);
console.log(
  `[history] ${messages.map((message) => (message as { type?: string }).type ?? "?").join(" -> ")}`,
);

if (!recall.toLowerCase().includes("bob")) {
  throw new Error(`checkpoint did not supply the name. Last: ${recall}`);
}
if (!transcript.includes("My name is Bob") || !transcript.includes("What's my name?")) {
  throw new Error("checkpointer dropped a turn");
}
