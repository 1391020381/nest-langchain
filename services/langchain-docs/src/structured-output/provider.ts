/**
 * https://docs.langchain.com/oss/javascript/langchain/structured-output
 * Provider strategy
 *
 * `providerStrategy` forces native JSON schema output. A bare schema does
 * that only when `model.profile.structuredOutput` is true; otherwise
 * `createAgent` falls back to tool calling. This model's profile is empty,
 * so the two calls below take different paths. Valibot is the same wrapper
 * with another schema library.
 */
import { createAgent, providerStrategy } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const ContactInfo = z.object({
  name: z.string().describe("The name of the person"),
  email: z.string().describe("The email address of the person"),
  phone: z.string().describe("The phone number of the person"),
});

const model = docsModel();
const native =
  typeof model === "string" ? undefined : model.profile.structuredOutput === true;
console.log(`[profile] structuredOutput=${native === undefined ? "unresolved" : native}`);

const prompt = "Extract contact info from: John Doe, john@example.com, (555) 123-4567";

function textOf(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

function assertContact(value: unknown, label: string) {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} did not return structuredResponse`);
  }
  const contact = value as Record<string, unknown>;
  if (contact.name !== "John Doe" || contact.email !== "john@example.com") {
    throw new Error(`${label} parsed unexpected contact: ${JSON.stringify(contact)}`);
  }
  if (typeof contact.phone !== "string" || !contact.phone.includes("555")) {
    throw new Error(`${label} phone was ${JSON.stringify(contact.phone)}`);
  }
}

function trace(label: string, messages: Array<{ type: string; content: unknown; name?: string }>) {
  for (const message of messages) {
    console.log(`[${label}] ${message.type} ${message.name ?? ""} ${textOf(message.content)}`);
  }
}

console.log("\n== providerStrategy ==");
const forced = await createAgent({
  model,
  tools: [],
  responseFormat: providerStrategy(ContactInfo),
}).invoke({ messages: [{ role: "user", content: prompt }] });
trace("provider", forced.messages);
console.log(`[provider] ${JSON.stringify(forced.structuredResponse)}`);
assertContact(forced.structuredResponse, "providerStrategy");
if (forced.messages.some((message) => message.type === "tool")) {
  throw new Error("providerStrategy fell back to a tool call");
}

console.log("\n== bare schema ==");
const bare = await createAgent({
  model,
  tools: [],
  responseFormat: ContactInfo,
}).invoke({ messages: [{ role: "user", content: prompt }] });
trace("schema", bare.messages);
console.log(`[schema] ${JSON.stringify(bare.structuredResponse)}`);
assertContact(bare.structuredResponse, "bare schema");
const usedTool = bare.messages.some((message) => message.type === "tool");
if (native === true && usedTool) {
  throw new Error("profile reports structuredOutput, but the bare schema used a tool");
}
if (native === false && !usedTool) {
  throw new Error("profile does not report structuredOutput, but the bare schema did not use a tool");
}
