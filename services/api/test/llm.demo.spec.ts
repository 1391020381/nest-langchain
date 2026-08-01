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

  test("promptPreview renders without calling the model", async () => {
    const service = new LlmService();
    const { rendered } = await service.promptPreview(SAMPLE);
    expect(rendered).toContain(SAMPLE);
  });

  test.skipIf(!hasKey)("chainInvoke returns non-empty text", async () => {
    const service = new LlmService();
    const { result } = await service.chainInvoke(SAMPLE);
    expect(result.length).toBeGreaterThan(0);
  });

  test("tool demo methods are defined", () => {
    const service = new LlmService();
    expect(typeof service.toolBindDemo).toBe("function");
    expect(typeof service.toolLoopDemo).toBe("function");
  });

  test.skipIf(!hasKey)("toolBindDemo returns toolCalls array field", async () => {
    const service = new LlmService();
    const result = await service.toolBindDemo(SAMPLE);
    expect(Array.isArray(result.toolCalls)).toBe(true);
    expect(typeof result.result).toBe("string");
  });
});
