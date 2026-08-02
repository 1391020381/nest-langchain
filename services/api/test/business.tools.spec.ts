import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  queryOrderTool,
  readFileTool,
  safePath,
  writeFileTool,
} from "../src/llm/tools/business.tools";

describe("business tools", () => {
  test("safePath rejects workspace escape", () => {
    expect(() => safePath("../../../etc/passwd")).toThrow(
      "路径不允许逃逸工作目录"
    );
  });

  test("query_order returns seed order", async () => {
    const result = await queryOrderTool.invoke({ orderId: "EC20240315001" });
    expect(result.orderId).toBe("EC20240315001");
    expect(result.productId).toBe("headphone-x1");
  });

  test("read_file returns return policy", async () => {
    const result = await readFileTool.invoke({
      filePath: "policies/return-policy.md",
    });
    expect(result.content).toContain("7 天无理由退货");
  });

  test("write_file writes under tickets and can be read back", async () => {
    const filePath = "tickets/_unit-test.md";
    await writeFileTool.invoke({ filePath, content: "unit-test-content" });
    const full = path.join(process.cwd(), "workspace", filePath);
    expect(fs.readFileSync(full, "utf8")).toBe("unit-test-content");
    fs.unlinkSync(full);
  });
});
