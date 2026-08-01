import { describe, expect, test } from "bun:test";
import {
  checkConstraintValidityTool,
  lookupEntityDefinitionTool,
} from "../src/llm/tools/basic.tools";

describe("basic tools", () => {
  test("check_constraint_validity passes explicit constraints", async () => {
    const result = await checkConstraintValidityTool.invoke({
      constraint: "必须绑定手机号",
    });
    expect(result.passed).toBe(true);
  });

  test("lookup_entity_definition returns known entity", async () => {
    const result = await lookupEntityDefinitionTool.invoke({ entity: "密码" });
    expect(result.definition).toContain("登录");
  });
});
