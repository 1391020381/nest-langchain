/**
 * https://docs.langchain.com/oss/javascript/langchain/guardrails
 * strategy "block" throws before the model call when an email is present.
 */
import { createAgent, PIIDetectionError, piiMiddleware } from "langchain";
import { docsModel } from "../model";

const agent = createAgent({
  model: docsModel(),
  tools: [],
  middleware: [
    piiMiddleware("email", { strategy: "block", applyToInput: true }),
  ],
});

try {
  await agent.invoke({
    messages: [{ role: "user", content: "Email me at ada@example.com." }],
  });
  throw new Error("email was not blocked");
} catch (error) {
  if (!(error instanceof PIIDetectionError)) throw error;
  console.log(`[blocked] ${error.piiType} matches=${error.matches.length}`);
}
