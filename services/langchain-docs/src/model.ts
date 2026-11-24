import { ChatOpenAI } from "@langchain/openai";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(packageRoot, ".env") });

export function docsModel(): string | ChatOpenAI {
  const model = process.env.LANGCHAIN_MODEL?.trim();
  if (!model) {
    throw new Error(
      "Set LANGCHAIN_MODEL in services/langchain-docs/.env (see .env.example).",
    );
  }

  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  const usesOpenAi =
    !model.includes(":") || model.startsWith("openai:");
  if (!baseURL || !usesOpenAi) {
    return model;
  }

  return new ChatOpenAI({
    model: model.replace(/^openai:/, ""),
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL },
  });
}
