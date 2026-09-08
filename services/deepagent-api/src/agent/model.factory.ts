import { ChatOpenAI } from "@langchain/openai";

export function createConfiguredModel(): ChatOpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY 未配置。请复制 services/deepagent-api/.env.example 为 .env 并填写模型凭据。",
    );
  }

  return new ChatOpenAI({
    model: process.env.DEEPAGENT_MODEL?.trim() || "gpt-5.4",
    temperature: 0,
    maxTokens: 6_000,
    apiKey,
    configuration: process.env.OPENAI_BASE_URL?.trim()
      ? { baseURL: process.env.OPENAI_BASE_URL.trim() }
      : undefined,
  });
}
