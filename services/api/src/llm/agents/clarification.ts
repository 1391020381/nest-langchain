export type ExtractFields = {
  orderId: string | null;
  productId: string | null;
  requestType: string | null;
  receivedDate: string | null;
  isUnopened: boolean | null;
};

export function clarificationFromExtract(parsed: ExtractFields): string[] {
  const clarificationQuestions: string[] = [];
  if (!parsed.orderId) clarificationQuestions.push("请提供订单号");
  if (!parsed.requestType) {
    clarificationQuestions.push("请说明是退货、换货还是退款");
  }
  return clarificationQuestions;
}
