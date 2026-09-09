import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";

const ALLOWED_MODEL_ENV_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "DEEPAGENT_MODEL",
  "OPENAI_MODEL",
] as const;

type AllowedModelEnvKey = (typeof ALLOWED_MODEL_ENV_KEYS)[number];

export interface LoadedModelEnvironment {
  loadedKeys: AllowedModelEnvKey[];
  checkedFiles: number;
}

/**
 * Loads only model-related values. Existing process variables win, then the
 * service-local .env wins over the allowlisted repository/legacy fallback.
 */
export function loadAllowedModelEnvironment(
  serviceRoot: string,
): LoadedModelEnvironment {
  const repositoryRoot = resolve(serviceRoot, "../..");
  const repositoryEnv = resolve(repositoryRoot, ".env");
  const existingModelEnv = resolve(repositoryRoot, "services/chat/.env");
  const serviceEnv = resolve(serviceRoot, ".env");
  let checkedFiles = 0;

  // The new service owns its complete local configuration.
  if (existsSync(serviceEnv)) {
    checkedFiles += 1;
    const localValues = parse(readFileSync(serviceEnv));
    for (const [key, rawValue] of Object.entries(localValues)) {
      if (process.env[key] === undefined) process.env[key] = rawValue;
    }
  }

  // Existing env files are only fallbacks for explicitly allowed model
  // values. Unrelated legacy configuration is deliberately not imported.
  const fallbackValues: Record<string, string> = {};
  for (const fallbackFile of [repositoryEnv, existingModelEnv]) {
    if (!existsSync(fallbackFile)) continue;
    checkedFiles += 1;
    const parsed = parse(readFileSync(fallbackFile));
    for (const key of ALLOWED_MODEL_ENV_KEYS) {
      const value = parsed[key]?.trim();
      if (value) fallbackValues[key] = value;
    }
  }

  const loadedKeys: AllowedModelEnvKey[] = [];
  for (const key of ALLOWED_MODEL_ENV_KEYS) {
    const value = fallbackValues[key]?.trim();
    if (process.env[key]?.trim() || !value) continue;
    process.env[key] = value;
    loadedKeys.push(key);
  }

  return { loadedKeys, checkedFiles };
}
