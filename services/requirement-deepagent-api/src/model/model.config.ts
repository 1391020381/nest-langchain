import type { PublicModelConfiguration } from "@autix/requirement-deepagent-contracts";

export const DEFAULT_DEEPAGENT_MODEL = "gpt-5.4";
export const DEFAULT_MODEL_DIAGNOSTIC_TIMEOUT_MS = 15_000;
export const DEFAULT_REQUIREMENT_MODEL_TIMEOUT_MS = 120_000;
export const DEFAULT_REQUIREMENT_RUN_TIMEOUT_MS = 300_000;
export const DEFAULT_REQUIREMENT_RECURSION_LIMIT = 60;

export interface ModelRuntimeConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  timeoutMs: number;
}

export interface RequirementRuntimeConfig {
  modelTimeoutMs: number;
  runTimeoutMs: number;
  recursionLimit: number;
}

function optionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function diagnosticTimeout(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1_000 || parsed > 120_000) {
    return DEFAULT_MODEL_DIAGNOSTIC_TIMEOUT_MS;
  }
  return Math.round(parsed);
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    return fallback;
  }
  return Math.round(parsed);
}

export function readModelRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): ModelRuntimeConfig {
  return {
    apiKey: optionalValue(env.OPENAI_API_KEY),
    baseUrl: optionalValue(env.OPENAI_BASE_URL),
    model:
      optionalValue(env.DEEPAGENT_MODEL) ??
      optionalValue(env.OPENAI_MODEL) ??
      DEFAULT_DEEPAGENT_MODEL,
    timeoutMs: diagnosticTimeout(env.MODEL_DIAGNOSTIC_TIMEOUT_MS),
  };
}

export function readRequirementRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): RequirementRuntimeConfig {
  return {
    modelTimeoutMs: boundedInteger(
      env.REQUIREMENT_AGENT_MODEL_TIMEOUT_MS,
      DEFAULT_REQUIREMENT_MODEL_TIMEOUT_MS,
      10_000,
      600_000,
    ),
    runTimeoutMs: boundedInteger(
      env.REQUIREMENT_AGENT_RUN_TIMEOUT_MS,
      DEFAULT_REQUIREMENT_RUN_TIMEOUT_MS,
      30_000,
      1_800_000,
    ),
    recursionLimit: boundedInteger(
      env.REQUIREMENT_AGENT_RECURSION_LIMIT,
      DEFAULT_REQUIREMENT_RECURSION_LIMIT,
      10,
      200,
    ),
  };
}

export function toPublicModelConfiguration(
  config: ModelRuntimeConfig,
): PublicModelConfiguration {
  return {
    model: config.model,
    apiKeyConfigured: Boolean(config.apiKey),
    baseUrlConfigured: Boolean(config.baseUrl),
  };
}
