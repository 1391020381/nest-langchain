import { describe, expect, test } from "bun:test";
import { RequirementResultSchema, RequirementSchema } from "../src/index";

describe("Requirement schemas", () => {
  test("rejects empty input", () => {
    const parsed = RequirementSchema.safeParse({ input: "" });
    expect(parsed.success).toBe(false);
  });

  test("accepts valid result shape", () => {
    const parsed = RequirementResultSchema.safeParse({
      action: "用户注册",
      constraints: ["必须绑定手机号"],
      entities: ["用户", "手机号"],
    });
    expect(parsed.success).toBe(true);
  });
});
