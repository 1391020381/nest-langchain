/**
 * https://docs.langchain.com/oss/javascript/langchain/models
 * Invocation: invoke, stream, and batch
 */
import { config } from "dotenv";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  initChatModel,
} from "langchain";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(packageRoot, ".env") });

const modelName = process.env.LANGCHAIN_MODEL?.trim();
if (!modelName) {
  throw new Error(
    "Set LANGCHAIN_MODEL in services/langchain-docs/.env (see .env.example).",
  );
}

const baseURL = process.env.OPENAI_BASE_URL?.trim();
const usesOpenAi = !modelName.includes(":") || modelName.startsWith("openai:");
const openAiCompatible = Boolean(baseURL) && usesOpenAi;

const model = await initChatModel(
  openAiCompatible ? modelName.replace(/^openai:/, "") : modelName,
  {
    ...(openAiCompatible
      ? {
          modelProvider: "openai",
          apiKey: process.env.OPENAI_API_KEY,
          configuration: { baseURL },
        }
      : {}),
    temperature: 0,
    maxTokens: 200,
    timeout: 120_000,
    maxRetries: 6,
  },
);

console.log("== invoke ==");
const direct = await model.invoke("Reply with the single word: ok");
console.log(`[string] ${direct.text}`);

const conversation = [
  new SystemMessage(
    "You are a helpful assistant that translates English to French. Reply with only the French translation.",
  ),
  new HumanMessage("Translate: I love programming."),
  new AIMessage("J'adore la programmation."),
  new HumanMessage("Translate: I love building applications."),
];
const translated = await model.invoke(conversation);
console.log(`[messages] ${translated.text}`);

console.log("\n== stream ==");
const stream = await model.stream(
  "What color is the sky? Answer in one short sentence.",
);
let full: AIMessageChunk | null = null;
for await (const chunk of stream) {
  full = full ? full.concat(chunk) : chunk;
  for (const block of chunk.contentBlocks) {
    if (block.type === "reasoning" && block.reasoning.length > 0) {
      process.stdout.write(block.reasoning);
    } else if (block.type === "text" && block.text.length > 0) {
      process.stdout.write(block.text);
    }
  }
}
console.log(`\n[gathered] ${full?.text ?? ""}`);

console.log("\n== batch ==");
const responses = await model.batch(
  [
    "Reply with the single word: red",
    "Reply with the single word: green",
    "Reply with the single word: blue",
  ],
  { maxConcurrency: 2 },
);
for (const [index, response] of responses.entries()) {
  console.log(`[${index}] ${response.text}`);
}
