/**
 * https://docs.langchain.com/oss/javascript/langchain/quickstart
 * Build a real-world agent — 3. Configure your model
 */
import { config } from "dotenv";
import { initChatModel } from "langchain";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

export const model = await initChatModel(
  openAiCompatible ? modelName.replace(/^openai:/, "") : modelName,
  {
    ...(openAiCompatible
      ? {
          modelProvider: "openai",
          apiKey: process.env.OPENAI_API_KEY,
          configuration: { baseURL },
        }
      : {}),
    temperature: 0.5,
    // The OpenAI client counts timeout in milliseconds. The quickstart's 300 is 300 seconds.
    timeout: 300_000,
    maxTokens: 25000,
  },
);

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const response = await model.invoke("Reply with the single word: ok");
  const text =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);
  console.log(text);
}
