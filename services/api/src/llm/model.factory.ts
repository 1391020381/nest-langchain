import { createChatModel as createCoreChatModel } from "@autix/llm-core";
import {
  getApiKeys,
  loadLangChainConfig,
} from "../config/load-langchain-config";

export function createChatModel() {
  const config = loadLangChainConfig();
  const keys = getApiKeys();
  return createCoreChatModel({
    model: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
    openAIApiKey: keys.openaiApiKey,
    openAIBaseUrl: keys.openaiBaseUrl,
  });
}
