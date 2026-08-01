import { describe, expect, test } from "bun:test";
import { requirementPrompt } from "../src/llm/requirement.prompt-builder";

describe("requirementPrompt", () => {
  test("renders input into human message", async () => {
    const value = await requirementPrompt.invoke({
      input: "用户注册时必须绑定手机号，密码至少8位",
    });
    const text = value.toString();
    expect(text).toContain("用户注册时必须绑定手机号");
    expect(text).toContain("需求结构化抽取助手");
  });
});
