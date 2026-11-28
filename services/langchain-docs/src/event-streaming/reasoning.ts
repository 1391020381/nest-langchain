/**
 * https://docs.langchain.com/oss/javascript/langchain/event-streaming
 * Reasoning content
 *
 * `message.reasoning` has the same shape as `message.text` and stays empty
 * when the configured model does not emit reasoning blocks. The answer text
 * is still required.
 */
import { createAgent } from "langchain";
import { docsModel } from "../model";

const agent = createAgent({
  model: docsModel(),
  tools: [],
  systemPrompt: "Answer in one short sentence.",
});

const stream = await agent.streamEvents(
  { messages: [{ role: "user", content: "Why is the sky blue? Answer in one sentence." }] },
  { version: "v3", recursionLimit: 4 },
);

let reasoning = "";
let text = "";
for await (const message of stream.messages) {
  for await (const delta of message.reasoning) {
    reasoning += delta;
    process.stdout.write(`[thinking] ${delta}`);
  }
  for await (const delta of message.text) {
    text += delta;
    process.stdout.write(delta);
  }
  process.stdout.write("\n");
}

if (reasoning.length > 0) {
  console.log(`[reasoning] ${reasoning.length} chars`);
} else {
  console.log("[reasoning] skip: this model returned no reasoning deltas");
}
if (text.length === 0) {
  throw new Error("reasoning projection produced no answer text");
}
console.log(`[answer] ${text}`);
