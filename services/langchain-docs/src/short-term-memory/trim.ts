/**
 * https://docs.langchain.com/oss/javascript/langchain/short-term-memory
 * Trim messages before the model call.
 *
 * Both hooks write the trimmed list back onto the thread with
 * RemoveMessage(REMOVE_ALL_MESSAGES). The page's trimMessages sample counts
 * each message as one token and sets maxTokens to 384, so a short thread
 * never shrinks. This run uses that same counter with a budget of 3.
 */
import { RemoveMessage } from "@langchain/core/messages";
import { MemorySaver, REMOVE_ALL_MESSAGES } from "@langchain/langgraph";
import { createAgent, createMiddleware, trimMessages } from "langchain";
import { docsModel } from "../model";

const prompts = [
  "Remember this code: alpha.",
  "Remember this code: beta.",
  "Remember this code: gamma.",
  "Remember this code: delta.",
];

function textOf(message: { text?: string; content?: unknown }) {
  if (typeof message.text === "string" && message.text.length > 0) {
    return message.text;
  }
  return typeof message.content === "string"
    ? message.content
    : JSON.stringify(message.content ?? "");
}

const windowCut = { from: 0, to: 0 };
const trimWindow = createMiddleware({
  name: "TrimMessages",
  beforeModel: (state) => {
    const messages = state.messages;
    if (messages.length <= 3) return;
    const first = messages[0];
    if (!first) return;
    const recent =
      messages.length % 2 === 0 ? messages.slice(-3) : messages.slice(-4);
    const kept = [first, ...recent];
    if (kept.length >= messages.length) return;
    windowCut.from = messages.length;
    windowCut.to = kept.length;
    console.log(`[window] ${messages.length} -> ${kept.length}`);
    return {
      messages: [new RemoveMessage({ id: REMOVE_ALL_MESSAGES }), ...kept],
    };
  },
});

const tokenCut = { from: 0, to: 0 };
const trimByCount = createMiddleware({
  name: "TrimMessagesByCount",
  beforeModel: async (state) => {
    const trimmed = await trimMessages(state.messages, {
      maxTokens: 3,
      strategy: "last",
      startOn: "human",
      endOn: ["human", "tool"],
      tokenCounter: (msgs) => msgs.length,
    });
    if (trimmed.length >= state.messages.length) return;
    tokenCut.from = state.messages.length;
    tokenCut.to = trimmed.length;
    console.log(`[trimMessages] ${state.messages.length} -> ${trimmed.length}`);
    return {
      messages: [new RemoveMessage({ id: REMOVE_ALL_MESSAGES }), ...trimmed],
    };
  },
});

async function runTurns(
  middleware: ReturnType<typeof createMiddleware>,
  threadId: string,
) {
  const checkpointer = new MemorySaver();
  const agent = createAgent({
    model: docsModel(),
    tools: [],
    systemPrompt: "Reply with exactly: ok",
    middleware: [middleware],
    checkpointer,
  });
  const thread = { configurable: { thread_id: threadId }, recursionLimit: 4 };
  for (const content of prompts) {
    await agent.invoke({ messages: [{ role: "user", content }] }, thread);
  }

  const tuple = await checkpointer.getTuple({ configurable: { thread_id: threadId } });
  const messages = tuple?.checkpoint.channel_values.messages;
  if (!tuple || !Array.isArray(messages)) {
    throw new Error(`no checkpoint for ${threadId}`);
  }
  console.log(`[checkpoint] id=${tuple.checkpoint.id} messages=${messages.length}`);
  for (const message of messages) {
    const stored = message as { type?: string; text?: string; content?: unknown };
    const line = textOf(stored).replace(/\s+/g, " ").slice(0, 60);
    console.log(`  ${stored.type ?? "?"}: ${line}`);
  }
  return messages.length;
}

console.log("== window ==");
const windowLength = await runTurns(trimWindow, "trim-window");
if (windowCut.from === 0 || windowCut.to >= windowCut.from || windowLength >= prompts.length * 2) {
  throw new Error(
    `window trim did not shrink the thread (${windowCut.from} -> ${windowCut.to}, stored ${windowLength})`,
  );
}

console.log("\n== trimMessages ==");
const tokenLength = await runTurns(trimByCount, "trim-count");
if (tokenCut.from === 0 || tokenCut.to >= tokenCut.from || tokenLength >= prompts.length * 2) {
  throw new Error(
    `trimMessages did not shrink the thread (${tokenCut.from} -> ${tokenCut.to}, stored ${tokenLength})`,
  );
}
