import { describe, expect, test } from "bun:test";
import { getApiKeys, loadLangChainConfig } from "../src/config/load-langchain-config";

describe("loadLangChainConfig", () => {
  test("loads llm model from yaml", () => {
    const config = loadLangChainConfig();
    expect(config.llm.model.length).toBeGreaterThan(0);
    expect(typeof config.llm.temperature).toBe("number");
    expect(config.features.enableStructuredOutput).toBe(true);
  });
});

describe("getApiKeys", () => {
  test("reads OPENAI_API_KEY from env", () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test";
    const keys = getApiKeys();
    expect(keys.openaiApiKey).toBe("sk-test");
    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
  });
});
