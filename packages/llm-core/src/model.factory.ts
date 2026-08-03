import { ChatOpenAI } from "@langchain/openai";

export type ChatModelOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  openAIApiKey?: string;
  openAIBaseUrl?: string;
};

export function createChatModel(options: ChatModelOptions = {}) {
  const openAIApiKey =
    options.openAIApiKey ?? process.env.OPENAI_API_KEY ?? "";
  const openAIBaseUrl =
    options.openAIBaseUrl ?? process.env.OPENAI_BASE_URL;
  const model =
    options.model ?? process.env.OPENAI_MODEL ?? "deepseek-ai/DeepSeek-V4-Pro";
  const temperature = options.temperature ?? 0;
  const maxTokens = options.maxTokens ?? 800;

  if (!openAIApiKey) {
    console.warn(
      "[createChatModel] OPENAI_API_KEY is empty; model calls will fail until it is set"
    );
  }

  return new ChatOpenAI({
    model,
    temperature,
    maxTokens,
    openAIApiKey,
    configuration: openAIBaseUrl ? { baseURL: openAIBaseUrl } : undefined,
  });
}
