import { ChatOpenAI } from "@langchain/openai";
import type {
  ModelRuntimeConfig,
  RequirementRuntimeConfig,
} from "./model.config";

function createModel(config: ModelRuntimeConfig, timeoutMs: number): ChatOpenAI {
  if (!config.apiKey) {
    throw new Error("OPENAI_API_KEY is required before creating the model");
  }

  return new ChatOpenAI({
    model: config.model,
    apiKey: config.apiKey,
    temperature: 0,
    maxRetries: 0,
    timeout: timeoutMs,
    configuration: config.baseUrl
      ? {
          baseURL: config.baseUrl,
        }
      : undefined,
  });
}

export function createDiagnosticModel(config: ModelRuntimeConfig): ChatOpenAI {
  return createModel(config, config.timeoutMs);
}

export function createRequirementModel(
  config: ModelRuntimeConfig,
  runtime: RequirementRuntimeConfig,
): ChatOpenAI {
  return createModel(config, runtime.modelTimeoutMs);
}
