import { describe, expect, it } from "bun:test";
import {
  DEFAULT_DEEPAGENT_MODEL,
  DEFAULT_MODEL_DIAGNOSTIC_TIMEOUT_MS,
  DEFAULT_REQUIREMENT_RECURSION_LIMIT,
  readModelRuntimeConfig,
  readRequirementRuntimeConfig,
  toPublicModelConfiguration,
} from "../src/model/model.config";

describe("model runtime configuration", () => {
  it("uses safe defaults without exposing a key", () => {
    const config = readModelRuntimeConfig({});
    expect(config.model).toBe(DEFAULT_DEEPAGENT_MODEL);
    expect(config.timeoutMs).toBe(DEFAULT_MODEL_DIAGNOSTIC_TIMEOUT_MS);
    expect(toPublicModelConfiguration(config)).toEqual({
      model: DEFAULT_DEEPAGENT_MODEL,
      apiKeyConfigured: false,
      baseUrlConfigured: false,
    });
  });

  it("prefers DEEPAGENT_MODEL and clamps invalid timeouts", () => {
    const config = readModelRuntimeConfig({
      OPENAI_API_KEY: "secret-value",
      OPENAI_BASE_URL: "https://provider.example/v1",
      DEEPAGENT_MODEL: "tool-model",
      OPENAI_MODEL: "fallback-model",
      MODEL_DIAGNOSTIC_TIMEOUT_MS: "10",
    });
    expect(config.model).toBe("tool-model");
    expect(config.timeoutMs).toBe(DEFAULT_MODEL_DIAGNOSTIC_TIMEOUT_MS);
    expect(toPublicModelConfiguration(config)).toEqual({
      model: "tool-model",
      apiKeyConfigured: true,
      baseUrlConfigured: true,
    });
  });

  it("bounds agent run limits independently from diagnostic settings", () => {
    expect(
      readRequirementRuntimeConfig({
        REQUIREMENT_AGENT_MODEL_TIMEOUT_MS: "90000",
        REQUIREMENT_AGENT_RUN_TIMEOUT_MS: "180000",
        REQUIREMENT_AGENT_RECURSION_LIMIT: "40",
      }),
    ).toEqual({
      modelTimeoutMs: 90_000,
      runTimeoutMs: 180_000,
      recursionLimit: 40,
    });
    expect(
      readRequirementRuntimeConfig({
        REQUIREMENT_AGENT_RECURSION_LIMIT: "999",
      }).recursionLimit,
    ).toBe(DEFAULT_REQUIREMENT_RECURSION_LIMIT);
  });
});
