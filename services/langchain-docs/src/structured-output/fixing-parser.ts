/**
 * https://docs.langchain.com/oss/javascript/langchain/structured-output
 * Handle parsing errors in chains
 *
 * `OutputFixingParser` retries only `OutputParserException`. It lives in
 * `@langchain/classic`, and so does `StructuredOutputParser` in this install
 * (the page imports that parser from `@langchain/core`). The chain is the
 * happy path. A second parse sends malformed text so the fixing model runs.
 */
import { OutputFixingParser, StructuredOutputParser } from "@langchain/classic/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import * as z from "zod";
import { docsChatModel } from "../models/chat-model";

const ProductReview = z.object({
  rating: z.number().min(1).max(5).describe("The rating of the product (1-5)"),
  sentiment: z.enum(["positive", "negative"]).describe("The sentiment of the review"),
});

const model = await docsChatModel();
const baseParser = StructuredOutputParser.fromZodSchema(ProductReview);
const fixingParser = OutputFixingParser.fromLLM(model, baseParser);

function assertReview(value: unknown, label: string) {
  if (!value || typeof value !== "object") throw new Error(`${label} did not parse`);
  const review = value as Record<string, unknown>;
  if (typeof review.rating !== "number" || review.rating < 1 || review.rating > 5) {
    throw new Error(`${label} rating ${JSON.stringify(review.rating)}`);
  }
  if (review.sentiment !== "positive" && review.sentiment !== "negative") {
    throw new Error(`${label} sentiment ${JSON.stringify(review.sentiment)}`);
  }
}

console.log("== chain ==");
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "Analyze the product review.\n{format_instructions}"],
  ["user", "{review}"],
]);
const chain = prompt.pipe(model).pipe(fixingParser);
const reviewed = await chain.invoke({
  review: "Great product, 5 stars! Fast shipping, but expensive.",
  format_instructions: baseParser.getFormatInstructions(),
});
console.log(`[chain] ${JSON.stringify(reviewed)}`);
assertReview(reviewed, "chain");
if (reviewed.sentiment !== "positive") {
  throw new Error("expected a positive review");
}

console.log("\n== malformed output ==");
const fixed = await fixingParser.parse(
  "Great product, 5 stars! Fast shipping, but expensive.",
);
console.log(`[fixed] ${JSON.stringify(fixed)}`);
assertReview(fixed, "fixing parser");
if (fixed.sentiment !== "positive" || fixed.rating !== 5) {
  throw new Error(`expected the prose review to be repaired as 5/positive, got ${JSON.stringify(fixed)}`);
}
