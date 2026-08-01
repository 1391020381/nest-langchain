import { describe, expect, test } from "bun:test";
import { LlmService } from "../src/llm/llm.service";

const SAMPLE = "用户注册时必须绑定手机号，密码至少8位";
const hasKey = Boolean(process.env.OPENAI_API_KEY);

describe("LlmService demos", () => {
  test.skipIf(!hasKey)("invokeDemo returns non-empty text", async () => {
    const service = new LlmService();
    const result = await service.invokeDemo(SAMPLE);
    expect(result.length).toBeGreaterThan(0);
  });
});
