import { describe, expect, test } from "bun:test";
import { createChatModel } from "../src/llm/model.factory";

describe("createChatModel", () => {
  test("returns a chat model instance with invoke", () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-placeholder";
    const model = createChatModel();
    expect(typeof model.invoke).toBe("function");
    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
  });
});
