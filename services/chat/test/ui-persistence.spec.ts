import { describe, expect, test } from "bun:test";
import {
  extractCollectedData,
  formatActionContent,
  mergeCollectedData,
} from "../src/llm/ui-protocol/ui-persistence";
import type { UIAction } from "../src/llm/ui-protocol/ui-types";

describe("extractCollectedData", () => {
  test("reads context from latest ai metadata.ui", () => {
    const data = extractCollectedData([
      {
        role: "ai",
        metadata: {
          ui: {
            version: "1.0",
            message: "ok",
            components: [],
            context: { collectedData: { title: "旧" } },
          },
        },
      },
      {
        role: "ai",
        metadata: {
          ui: {
            version: "1.0",
            message: "ok",
            components: [],
            context: { collectedData: { title: "新", priority: "P1" } },
          },
        },
      },
    ]);
    expect(data).toEqual({ title: "新", priority: "P1" });
  });

  test("returns empty object when no ai messages have collectedData", () => {
    expect(
      extractCollectedData([
        { role: "human", metadata: null },
        { role: "ai", metadata: { ui: { version: "1.0", message: "ok", components: [] } } },
      ]),
    ).toEqual({});
  });
});

describe("formatActionContent", () => {
  test("formats select action", () => {
    expect(
      formatActionContent({
        componentType: "selection",
        payload: { type: "select", selectedId: "functional" },
      }),
    ).toBe("[UI 操作: selection → select]");
  });
});

describe("mergeCollectedData", () => {
  test("mergeCollectedData stores lastConfirmed", () => {
    const action: UIAction = {
      componentType: "confirmation",
      payload: { type: "confirm", confirmed: true },
    };
    expect(mergeCollectedData({}, action).lastConfirmed).toBe(true);
  });

  test("select sets reqType when absent", () => {
    const action: UIAction = {
      componentType: "selection",
      payload: { type: "select", selectedId: "functional" },
    };
    expect(mergeCollectedData({}, action)).toEqual({
      lastSelectedId: "functional",
      reqType: "functional",
    });
  });

  test("submit merges formData", () => {
    const action: UIAction = {
      componentType: "form",
      payload: { type: "submit", formData: { title: "批量导入" } },
    };
    expect(mergeCollectedData({ reqType: "functional" }, action)).toEqual({
      reqType: "functional",
      title: "批量导入",
    });
  });
});
