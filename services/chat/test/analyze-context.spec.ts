import { describe, expect, test } from "bun:test";
import { buildAnalyzeInput } from "../src/conversation/analyze.service";

describe("buildAnalyzeInput", () => {
  test("includes conversation history, retrieved documents, and user input", () => {
    const result = buildAnalyzeInput({
      historyText: "human: 订单号是 EC20240315001",
      retrieved: ["退款政策：7 天内可申请退款"],
      input: "我要退款",
    });

    expect(result).toContain("历史对话");
    expect(result).toContain("订单号是 EC20240315001");
    expect(result).toContain("相关文档");
    expect(result).toContain("退款政策：7 天内可申请退款");
    expect(result).toContain("用户输入");
    expect(result).toContain("我要退款");
  });

  test("omits empty history and retrieved document sections", () => {
    const result = buildAnalyzeInput({
      historyText: "",
      retrieved: [],
      input: "你好",
    });

    expect(result).toBe("用户输入：\n你好");
  });
});
