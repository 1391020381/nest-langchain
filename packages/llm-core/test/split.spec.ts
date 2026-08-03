import { describe, expect, test } from "bun:test";
import { splitText } from "../src/text/split";

describe("splitText", () => {
  test("splits long text into overlapping chunks", async () => {
    const text = "测".repeat(1200);
    const chunks = await splitText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.length).toBeLessThanOrEqual(500);
  });
});
