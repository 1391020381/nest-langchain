import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, convertCurrency, convertCurrencyTool } from "./calculator-tools";

test("四则运算优先级、括号、小数和一元负号", () => {
  assert.equal(calculate("1 + 2 * 3"), 7);
  assert.equal(calculate("-(1 + 2) * -3 + .5"), 9.5);
  assert.equal(calculate("8 / 2 / 2 - 1"), 1);
  assert.equal(calculate("720 * 1.08"), 777.6);
});
test("拒绝代码、不完整表达式和除零", () => {
  for (const expression of ["process.exit()", "1 2", "", "(1+2", "2+", "1/0", "2**3"]) {
    assert.throws(() => calculate(expression));
  }
});
test("模拟汇率支持默认人民币、反向和跨币种换算", async () => {
  assert.equal(convertCurrency(100, "USD").amount, 720);
  assert.equal(convertCurrency(720, "CNY", "USD").amount, 100);
  assert.equal(convertCurrency(100, "EUR", "USD").amount, 108.33);
  const result = JSON.parse(await convertCurrencyTool.invoke({ amount: 100, from_currency: "USD" }));
  assert.equal(result.currency, "CNY");
  assert.equal(result.amount, 720);
});
