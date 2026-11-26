/**
 * https://docs.langchain.com/oss/javascript/langchain/models
 * Initialize a model, parameters, and connection resilience
 *
 * The parameters section writes `timeout: 30` and calls the unit seconds.
 * The connection-resilience section writes `timeout: 120_000` and calls it
 * milliseconds. `@langchain/openai` forwards `timeout` to the OpenAI client,
 * which counts milliseconds (same note as `src/quickstart/model.ts`).
 */
import { config } from "dotenv";
import { createAgent, initChatModel } from "langchain";
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

const temperature = 0.7;
const maxTokens = 1000;
const timeout = 120_000;
const maxRetries = 10;

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
    temperature,
    maxTokens,
    timeout,
    maxRetries,
  },
);

console.log(
  `[init] model=${modelName} temperature=${temperature} maxTokens=${maxTokens} timeout=${timeout}ms maxRetries=${maxRetries}`,
);

function textOf(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

const response = await model.invoke("Reply with the single word: ok");
console.log(`[invoke] ${textOf(response.content)}`);

const agent = createAgent({
  model,
  tools: [],
  systemPrompt: "Reply with the single word: ready",
});
const result = await agent.invoke({
  messages: [{ role: "user", content: "Go." }],
});
console.log(`[agent] ${textOf(result.messages.at(-1)?.content)}`);
