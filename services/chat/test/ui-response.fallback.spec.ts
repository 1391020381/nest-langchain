import { describe, expect, test } from "bun:test";
import { buildFallbackUIResponse } from "../src/llm/ui-protocol/ui-response.service";

describe("buildFallbackUIResponse", () => {
  test("returns text component", () => {
    const ui = buildFallbackUIResponse("boom");
    expect(ui.version).toBe("1.0");
    expect(ui.components[0]?.type).toBe("text");
  });
});
