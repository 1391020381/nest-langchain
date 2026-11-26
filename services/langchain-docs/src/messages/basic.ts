/**
 * https://docs.langchain.com/oss/javascript/langchain/messages
 * Basic usage: text prompts, message objects, and dictionary format
 */
import { AIMessage, HumanMessage, SystemMessage } from "langchain";
import { docsChatModel } from "../models/chat-model";

const model = await docsChatModel({ maxTokens: 32 });

console.log("== text prompt ==");
const text = await model.invoke("Reply with the single word: text");
console.log(`[text] ${text.text}`);

console.log("\n== message objects ==");
const objects = await model.invoke([
  new SystemMessage(
    "Translate English to French. Reply with only the French translation.",
  ),
  new HumanMessage("I love programming."),
  new AIMessage("J'adore la programmation."),
  new HumanMessage("I love building."),
]);
console.log(`[objects] ${objects.text}`);

console.log("\n== dictionary format ==");
const dictionary = await model.invoke([
  {
    role: "system",
    content: "Translate English to French. Reply with only the French translation.",
  },
  { role: "user", content: "I love programming." },
  { role: "assistant", content: "J'adore la programmation." },
  { role: "user", content: "I love building." },
]);
console.log(`[dictionary] ${dictionary.text}`);
