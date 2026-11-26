/**
 * https://docs.langchain.com/oss/javascript/langchain/models
 * Structured output with withStructuredOutput, including a refusal
 *
 * A safety refusal throws ModelRefusalError. includeRaw: true returns
 * parsed: null and leaves the refusal block on raw instead of throwing.
 * A normal answer takes the success path.
 */
import { ModelRefusalError } from "@langchain/core/errors";
import * as z from "zod";
import { docsChatModel } from "./chat-model";

const Movie = z.object({
  title: z.string().describe("The title of the movie"),
  year: z.number().describe("The year the movie was released"),
  director: z.string().describe("The director of the movie"),
  rating: z.number().describe("The movie's rating out of 10"),
});

const model = await docsChatModel();
const prompt = "Provide details about the movie Inception.";

console.log("== parsed ==");
try {
  const parsed = await model.withStructuredOutput(Movie).invoke(prompt);
  console.log(JSON.stringify(parsed));
  console.log("[refusal] no ModelRefusalError");
} catch (error) {
  if (!ModelRefusalError.isInstance(error)) throw error;
  console.log(`[refusal] ${error.message}`);
  console.log(`[raw] ${error.rawMessage?.text ?? ""}`);
}

console.log("\n== includeRaw ==");
const response = await model
  .withStructuredOutput(Movie, { includeRaw: true })
  .invoke(prompt);
console.log(`[parsed] ${JSON.stringify(response.parsed)}`);
const refusal = response.raw.contentBlocks.find((block) => block.type === "refusal");
console.log(
  `[refusal block] ${refusal?.type === "refusal" ? refusal.refusal : "none"}`,
);
