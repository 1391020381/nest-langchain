import { describe, expect, test } from "bun:test";
import { clarificationFromExtract } from "../src/agents/clarification";

describe("clarificationFromExtract", () => {
  test("asks for orderId and requestType when missing", () => {
    const questions = clarificationFromExtract({
      orderId: null,
      productId: null,
      requestType: null,
      receivedDate: null,
      isUnopened: null,
    });
    expect(questions).toContain("请提供订单号");
    expect(questions).toContain("请说明是退货、换货还是退款");
  });

  test("empty when required fields present", () => {
    const questions = clarificationFromExtract({
      orderId: "EC20240315001",
      productId: "headphone-x1",
      requestType: "退货",
      receivedDate: "2024-03-14",
      isUnopened: true,
    });
    expect(questions).toEqual([]);
  });
});
