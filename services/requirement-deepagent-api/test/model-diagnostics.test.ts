import { describe, expect, it } from "bun:test";
import {
  classifyProviderError,
  runModelDiagnostic,
} from "../src/model/model-diagnostics.service";
import type { ModelRuntimeConfig } from "../src/model/model.config";

const configured: ModelRuntimeConfig = {
  apiKey: "test-key",
  model: "tool-model",
  timeoutMs: 15_000,
};

describe("model diagnostics", () => {
  it("fails without calling the provider when no key is configured", async () => {
    let calls = 0;
    const result = await runModelDiagnostic(
      { model: "tool-model", timeoutMs: 15_000 },
      async () => {
        calls += 1;
      },
      () => 10,
    );
    expect(calls).toBe(0);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.code).toBe("MODEL_NOT_CONFIGURED");
    }
  });

  it("reports tool calling support after a successful probe", async () => {
    let now = 100;
    const result = await runModelDiagnostic(
      configured,
      async () => {
        now = 145;
      },
      () => now,
    );
    expect(result.status).toBe("ready");
    expect(result.latencyMs).toBe(45);
    expect(result.toolCalling.supported).toBe(true);
  });

  it("maps provider errors to stable public codes", async () => {
    const result = await runModelDiagnostic(configured, async () => {
      const error = new Error("Unauthorized");
      Object.assign(error, { status: 401 });
      throw error;
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.code).toBe("AUTHENTICATION_FAILED");
    }
    expect(classifyProviderError(new Error("fetch failed")).code).toBe(
      "PROVIDER_UNAVAILABLE",
    );
    const rejected = new Error("status code (no body)");
    Object.assign(rejected, { status: 400 });
    expect(classifyProviderError(rejected).code).toBe(
      "PROVIDER_REJECTED_REQUEST",
    );
  });
});
