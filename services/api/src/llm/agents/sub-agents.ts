import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createChatModel } from "../model.factory";

const model = createChatModel();
const parser = new StringOutputParser();

export const extractAgent = ChatPromptTemplate.fromMessages([
  [
    "system",
    `你是需求抽取专家。从电商客服对话中提取以下字段并输出 JSON：
- orderId: 订单号
- productId: 商品 ID（如 headphone-x1）
- requestType: 退货 | 换货 | 退款
- receivedDate: 收货日期（YYYY-MM-DD）
- isUnopened: 是否未拆封（true/false）
如果某字段在对话中未提及，设为 null。只输出 JSON，不要 Markdown。`,
  ],
  ["human", "{input}"],
])
  .pipe(model)
  .pipe(parser);

export const policyCheckAgent = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是政策校验专家。根据标准退货政策（7 天无理由退货，商品需未拆封），判断下面的抽取结果是否符合退货条件，并给出原因。",
  ],
  ["human", "{extractResult}"],
])
  .pipe(model)
  .pipe(parser);

export const riskReviewAgent = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是风险审查专家。请识别下面抽取结果中的歧义、信息缺失或潜在冲突，列出风险点。",
  ],
  ["human", "{extractResult}"],
])
  .pipe(model)
  .pipe(parser);

export const qaAgent = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是 QA 专家。根据用户对话和抽取结果，生成 Given-When-Then 格式的验收条件，覆盖正常路径和边界情况。",
  ],
  ["human", "用户对话：\n{input}\n\n抽取结果：\n{extractResult}"],
])
  .pipe(model)
  .pipe(parser);

export const summaryAgent = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是汇总专家。整合所有 Agent 输出，生成最终的退货判断报告，包括结论、依据和下一步操作建议。",
  ],
  [
    "human",
    "抽取结果：\n{extractResult}\n\n政策校验：\n{policyResult}\n\n风险审查：\n{riskResult}\n\nQA 验收条件：\n{qaResult}",
  ],
])
  .pipe(model)
  .pipe(parser);
