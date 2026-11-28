/**
 * https://docs.langchain.com/oss/javascript/langchain/structured-output
 * Tool calling strategy
 *
 * `toolStrategy` always binds a function tool, even when the model could
 * emit native JSON. A list of schemas lets the model pick one. Zod objects
 * have no JSON Schema title here, so the generated tool names are extract-N.
 */
import { createAgent, toolStrategy } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const ProductReview = z
  .object({
    rating: z.number().min(1).max(5).optional(),
    sentiment: z.enum(["positive", "negative"]),
    keyPoints: z.array(z.string()).describe("The key points of the review. Lowercase, 1-3 words each."),
  })
  .describe("Analyze a product review. Use this for praise, stars, or product opinions.");

const CustomerComplaint = z
  .object({
    issueType: z.enum(["product", "service", "shipping", "billing"]),
    severity: z.enum(["low", "medium", "high"]),
    description: z.string().describe("Brief description of the complaint"),
  })
  .describe("Record a customer complaint. Use this for problems, not reviews.");

const model = docsModel();

function assertReview(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("review structuredResponse missing");
  const review = value as Record<string, unknown>;
  if (review.sentiment !== "positive" && review.sentiment !== "negative") {
    throw new Error(`unexpected sentiment ${JSON.stringify(review.sentiment)}`);
  }
  if (!Array.isArray(review.keyPoints) || review.keyPoints.some((point) => typeof point !== "string")) {
    throw new Error(`unexpected keyPoints ${JSON.stringify(review.keyPoints)}`);
  }
  if (
    review.rating !== undefined &&
    (typeof review.rating !== "number" || review.rating < 1 || review.rating > 5)
  ) {
    throw new Error(`unexpected rating ${JSON.stringify(review.rating)}`);
  }
}

function assertComplaint(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("complaint structuredResponse missing");
  const complaint = value as Record<string, unknown>;
  const issues = ["product", "service", "shipping", "billing"];
  const severities = ["low", "medium", "high"];
  if (!issues.includes(String(complaint.issueType)) || !severities.includes(String(complaint.severity))) {
    throw new Error(`unexpected complaint ${JSON.stringify(complaint)}`);
  }
  if (typeof complaint.description !== "string" || complaint.description.length === 0) {
    throw new Error("complaint description missing");
  }
}

console.log("== one schema ==");
const review = await createAgent({
  model,
  tools: [],
  responseFormat: toolStrategy(ProductReview),
  systemPrompt: "Call the review tool once.",
}).invoke(
  {
    messages: [
      {
        role: "user",
        content: "Analyze this review: 'Great product: 5 out of 5 stars. Fast shipping, but expensive'",
      },
    ],
  },
  { recursionLimit: 8 },
);
console.log(`[review] ${JSON.stringify(review.structuredResponse)}`);
assertReview(review.structuredResponse);
if (review.structuredResponse.sentiment !== "positive") {
  throw new Error("expected a positive review");
}

console.log("\n== several schemas ==");
const complaint = await createAgent({
  model,
  tools: [],
  responseFormat: toolStrategy([ProductReview, CustomerComplaint]),
  systemPrompt: "This message is a complaint, not a review. Call the complaint tool once.",
}).invoke(
  {
    messages: [
      {
        role: "user",
        content: "I was charged twice and the package never arrived.",
      },
    ],
  },
  { recursionLimit: 8 },
);
console.log(`[complaint] ${JSON.stringify(complaint.structuredResponse)}`);
assertComplaint(complaint.structuredResponse);
