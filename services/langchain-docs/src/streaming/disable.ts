/**
 * https://docs.langchain.com/oss/javascript/langchain/streaming
 * Disable streaming
 *
 * The page sets `streaming: false` on `ChatOpenAI`. The base class switch
 * that makes `stream()` call `invoke()` is `disableStreaming: true`, and the
 * page says to use that when a provider has no `streaming` parameter.
 * `initChatModel` returns a `ConfigurableModel` whose `stream()` forwards to
 * the inner model, so both flags are passed into that inner constructor.
 */
import { docsChatModel, docsModelName } from "../models/chat-model";

const modelName = docsModelName();
const openAi = !modelName.includes(":") || modelName.startsWith("openai:");
const prompt =
  "Reply with exactly these words and nothing else: one two three four five six seven eight nine ten";

async function collect(model: Awaited<ReturnType<typeof docsChatModel>>) {
  let chunks = 0;
  let text = "";
  for await (const chunk of await model.stream(prompt)) {
    chunks += 1;
    text += chunk.text;
  }
  return { chunks, text };
}

console.log("== streaming ==");
const streamed = await collect(await docsChatModel({ maxTokens: 80 }));
console.log(`[chunks] ${streamed.chunks}`);
console.log(`[text] ${streamed.text}`);

console.log("\n== disabled ==");
const quiet = await collect(
  await docsChatModel({
    maxTokens: 80,
    disableStreaming: true,
    ...(openAi ? { streaming: false } : {}),
  }),
);
console.log(`[chunks] ${quiet.chunks}`);
console.log(`[text] ${quiet.text}`);

if (quiet.chunks !== 1) {
  throw new Error(
    `disableStreaming still yielded ${quiet.chunks} chunks (streaming run yielded ${streamed.chunks})`,
  );
}
if (streamed.chunks === 1) {
  console.log(
    "[note] the streaming run also returned a single chunk, so this endpoint is not splitting tokens",
  );
}
