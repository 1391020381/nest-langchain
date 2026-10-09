import { describe, expect, test } from "bun:test";
import {
  RequirementResultSchema,
  RequirementSchema,
} from "../src/index";

describe("requirement contracts", () => {
  test("normalizes a valid request", () => {
    expect(RequirementSchema.parse({ input: "  创建订单  " })).toEqual({
      input: "创建订单",
    });
  });

  test("rejects empty, oversized, and unexpected request fields", () => {
    expect(RequirementSchema.safeParse({ input: "   " }).success).toBe(false);
    expect(RequirementSchema.safeParse({ input: "x".repeat(4001) }).success).toBe(
      false
    );
    expect(
      RequirementSchema.safeParse({ input: "创建订单", admin: true }).success
    ).toBe(false);
  });

  test("rejects incomplete model output", () => {
    expect(
      RequirementResultSchema.safeParse({ action: "创建订单" }).success
    ).toBe(false);
  });
});
