import { ChatOpenAI } from "@langchain/openai";
import {
  getApiKeys,
  loadLangChainConfig,
} from "../config/load-langchain-config";

export function createChatModel() {
  const config = loadLangChainConfig();
  const keys = getApiKeys();

  if (!keys.openaiApiKey) {
    console.warn(
      "[createChatModel] OPENAI_API_KEY is empty; model calls will fail until it is set"
    );
  }

  return new ChatOpenAI({
    model: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
    openAIApiKey: keys.openaiApiKey,
    configuration: keys.openaiBaseUrl
      ? { baseURL: keys.openaiBaseUrl }
      : undefined,
  });
}
