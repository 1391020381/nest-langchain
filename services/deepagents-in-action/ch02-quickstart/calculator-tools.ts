import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/** 仅解析数字、括号和四则运算，不执行表达式中的 JavaScript。 */
export function calculate(expression: string): number {
  if (expression.length > 500) throw new Error("表达式不能超过 500 个字符");
  const tokens = expression.match(/\d+(?:\.\d*)?|\.\d+|[()+\-*/]|\S/g) ?? [];
  let index = 0;
  function factor(): number {
    const token = tokens[index++];
    if (token === "+") return factor();
    if (token === "-") return -factor();
    if (token === "(") {
      const value = sum();
      if (tokens[index++] !== ")") throw new Error("括号不匹配");
      return value;
    }
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      throw new Error("仅支持数字、括号和 + - * / 运算");
    }
    return Number(token);
  }
  function product(): number {
    let value = factor();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++];
      const right = factor();
      if (operator === "/" && right === 0) throw new Error("不能除以零");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const right = product();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }
  const value = sum();
  if (index !== tokens.length) throw new Error("表达式格式不正确");
  if (!Number.isFinite(value)) throw new Error("计算结果超出有限数值范围");
  return value;
}

const currency = z.enum(["USD", "CNY", "EUR"]);
type Currency = z.infer<typeof currency>;
const rates: Record<Currency, number> = { USD: 7.2, CNY: 1, EUR: 7.8 };

export function convertCurrency(amount: number, from: Currency, to: Currency = "CNY") {
  const converted = amount * rates[from] / rates[to];
  if (!Number.isFinite(converted)) throw new Error("换算结果超出有限数值范围");
  return { amount: Number(converted.toFixed(2)), currency: to, note: "固定演示汇率，非实时汇率" };
}

export const calculateTool = new DynamicStructuredTool({
  name: "calculate",
  description: "计算四则运算表达式，支持小数、负数、括号和 + - * /，例如 (1 + 2) * 3。",
  schema: z.object({ expression: z.string().min(1).max(500).describe("数学表达式") }),
  func: async ({ expression }) => {
    console.log(`[工具调用] calculate(${JSON.stringify({ expression })})`);
    try { return String(calculate(expression)); }
    catch (error) { return `计算失败：${(error as Error).message}`; }
  },
});

export const convertCurrencyTool = new DynamicStructuredTool({
  name: "convert_currency",
  description: "按固定教学汇率换算 USD、CNY、EUR，1 USD = 7.2 CNY，1 EUR = 7.8 CNY，非实时汇率。",
  schema: z.object({
    amount: z.number().finite().describe("待换算金额"),
    from_currency: currency.describe("原币种"),
    to_currency: currency.default("CNY").describe("目标币种，默认 CNY"),
  }),
  func: async ({ amount, from_currency, to_currency }) => {
    console.log(`[工具调用] convert_currency(${JSON.stringify({ amount, from_currency, to_currency })})`);
    try { return JSON.stringify(convertCurrency(amount, from_currency, to_currency)); }
    catch (error) { return `换算失败：${(error as Error).message}`; }
  },
});
