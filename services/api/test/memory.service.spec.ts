import { describe, expect, test } from "bun:test";
import { RunnableMemoryService } from "../src/llm/memory/runnable-memory.service";

describe("RunnableMemoryService history", () => {
  test("unknown session returns empty history", async () => {
    const svc = new RunnableMemoryService();
    const history = await svc.getHistory("missing");
    expect(history).toEqual([]);
  });

  test("appendMessage then clearSession", async () => {
    const svc = new RunnableMemoryService();
    await svc.appendMessage("s-test", "hello", "world");
    const history = await svc.getHistory("s-test");
    expect(history.length).toBe(2);
    svc.clearSession("s-test");
    expect(await svc.getHistory("s-test")).toEqual([]);
  });
});
