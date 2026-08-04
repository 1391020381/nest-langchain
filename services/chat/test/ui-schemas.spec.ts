import { describe, expect, test } from "bun:test";
import { aiUIResponseSchema } from "../src/llm/ui-protocol/ui-schemas";
import { validateUIResponse } from "../src/llm/ui-protocol/ui-validate";
import type { AIUIResponse } from "../src/llm/ui-protocol/ui-types";

describe("aiUIResponseSchema", () => {
  test("parses a selection response", () => {
    const parsed = aiUIResponseSchema.parse({
      version: "1.0",
      message: "请选择需求类型",
      components: [
        {
          type: "selection",
          title: "需求类型",
          options: [
            { id: "functional", label: "功能需求" },
            { id: "performance", label: "性能需求" },
          ],
        },
      ],
    });
    expect(parsed.components[0]?.type).toBe("selection");
  });

  test("rejects selection with fewer than 2 options", () => {
    expect(() =>
      aiUIResponseSchema.parse({
        version: "1.0",
        message: "x",
        components: [
          {
            type: "selection",
            title: "t",
            options: [{ id: "a", label: "A" }],
          },
        ],
      }),
    ).toThrow();
  });
});

describe("validateUIResponse", () => {
  test("fills empty message and drops invalid selection", () => {
    const input = {
      version: "1.0" as const,
      message: "   ",
      components: [
        {
          type: "selection" as const,
          title: "t",
          options: [{ id: "a", label: "A" }],
        },
        {
          type: "text" as const,
          content: "hello",
        },
      ],
    } satisfies AIUIResponse;

    const result = validateUIResponse(input);
    expect(result.message).toBe("正在为您处理...");
    expect(result.components).toEqual([{ type: "text", content: "hello" }]);
  });

  test("truncates components to 5", () => {
    const components = Array.from({ length: 7 }, (_, i) => ({
      type: "text" as const,
      content: `c${i}`,
    }));
    const result = validateUIResponse({
      version: "1.0",
      message: "ok",
      components,
    });
    expect(result.components).toHaveLength(5);
  });
});
