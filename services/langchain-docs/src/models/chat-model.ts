import { config } from "dotenv";
import { initChatModel } from "langchain";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(packageRoot, ".env") });

export type DocsChatModelFields = {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
  outputVersion?: "v0" | "v1";
};

export function docsModelName(): string {
  const modelName = process.env.LANGCHAIN_MODEL?.trim();
  if (!modelName) {
    throw new Error(
      "Set LANGCHAIN_MODEL in services/langchain-docs/.env (see .env.example).",
    );
  }
  return modelName;
}

export async function docsChatModel(fields: DocsChatModelFields = {}) {
  const modelName = docsModelName();
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  const usesOpenAi = !modelName.includes(":") || modelName.startsWith("openai:");
  const openAiCompatible = Boolean(baseURL) && usesOpenAi;

  return initChatModel(openAiCompatible ? modelName.replace(/^openai:/, "") : modelName, {
    ...(openAiCompatible
      ? {
          modelProvider: "openai",
          apiKey: process.env.OPENAI_API_KEY,
          configuration: { baseURL },
        }
      : {}),
    temperature: 0,
    maxTokens: 300,
    timeout: 120_000,
    maxRetries: 6,
    ...fields,
  });
}
