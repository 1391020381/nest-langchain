/**
 * https://docs.langchain.com/oss/javascript/langchain/structured-output
 * Model refusal
 *
 * `modelRefusalMiddleware` throws `ModelRefusalError` when a model response
 * contains a refusal content block. Ordinary text is not treated as a refusal.
 * This model does not emit that block for a contact-extraction prompt, so the
 * throw path is a scripted response and the success path is a real call.
 */
import { AIMessage } from "@langchain/core/messages";
import { ModelRefusalError } from "@langchain/core/errors";
import { createAgent, createMiddleware, modelRefusalMiddleware, toolStrategy } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const ContactInfo = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
});

const scriptRefusal = createMiddleware({
  name: "ScriptRefusal",
  wrapModelCall: () =>
    new AIMessage({
      content: [{ type: "refusal", refusal: "I can't extract that." }],
      response_metadata: { output_version: "v1" },
    }),
});

console.log("== refusal block ==");
let thrown: unknown;
try {
  await createAgent({
    model: docsModel(),
    tools: [],
    responseFormat: toolStrategy(ContactInfo),
    middleware: [modelRefusalMiddleware(), scriptRefusal],
  }).invoke({
    messages: [{ role: "user", content: "Extract contact info from: John Doe, john@example.com, (555) 123-4567" }],
  });
} catch (error) {
  thrown = error;
}
if (!ModelRefusalError.isInstance(thrown)) {
  throw new Error(
    `expected ModelRefusalError, got ${thrown instanceof Error ? thrown.message : String(thrown)}`,
  );
}
console.log(`[refusal] ${thrown.message}`);

console.log("\n== no refusal ==");
const result = await createAgent({
  model: docsModel(),
  tools: [],
  responseFormat: toolStrategy(ContactInfo),
  middleware: [modelRefusalMiddleware()],
  systemPrompt: "Call the contact tool once.",
}).invoke({
  messages: [
    {
      role: "user",
      content: "Extract contact info from: John Doe, john@example.com, (555) 123-4567",
    },
  ],
});
console.log(`[structured] ${JSON.stringify(result.structuredResponse)}`);
const contact = result.structuredResponse;
if (!contact || contact.name !== "John Doe" || contact.email !== "john@example.com") {
  throw new Error(`unexpected contact ${JSON.stringify(contact)}`);
}
