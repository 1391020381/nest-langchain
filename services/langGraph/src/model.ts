import { createChatModel } from "@autix/llm-core";

export function createLearningModel() {
  return createChatModel({
    model: process.env.OPENAI_MODEL,
    openAIApiKey: process.env.OPENAI_API_KEY,
    openAIBaseUrl: process.env.OPENAI_BASE_URL,
    temperature: 0,
    maxTokens: 2_000,
  });
}
