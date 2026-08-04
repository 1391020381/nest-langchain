import { expect, test } from "bun:test";
import { formatSse } from "../src/llm/ui-protocol/stream-format";

test("formatSse wraps JSON with data prefix", () => {
  const out = formatSse({
    messageType: "done",
    timestamp: "2026-08-04T00:00:00.000Z",
    payload: null,
  });
  expect(out.startsWith("data: ")).toBe(true);
  expect(out.endsWith("\n\n")).toBe(true);
  expect(JSON.parse(out.slice(6, -2)).messageType).toBe("done");
});
