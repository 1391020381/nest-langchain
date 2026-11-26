/**
 * https://docs.langchain.com/oss/javascript/langchain/messages
 * Message types: system, human, AI (tool calls, usage, finish reason, chunks), tool
 */
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  tool,
} from "langchain";
import * as z from "zod";
import { docsChatModel } from "../models/chat-model";

const model = await docsChatModel({ maxTokens: 64 });

function finishOf(metadata: Record<string, unknown>) {
  const raw = metadata.finish_reason;
  const normalized = metadata.normalized_finish_reason;
  return `finish_reason=${raw === undefined ? "absent" : String(raw)} normalized=${normalized === undefined ? "absent" : String(normalized)}`;
}

// console.log("== system / human ==");
// const guided = await model.invoke([
//   new SystemMessage("Reply with exactly the single word the user names."),
//   new HumanMessage("guided"),
// ]);
// console.log(`[guided] ${guided.text}`);

// const named = new HumanMessage({
//   content: "Hello!",
//   name: "alice",
//   id: "msg_123",
// });
// console.log(`[human] name=${named.name} id=${named.id} text=${named.text}`);

// console.log("\n== ai ==");
// const continued = await model.invoke([
//   new SystemMessage("Reply with only the number."),
//   new HumanMessage("Can you help me?"),
//   new AIMessage("I'd be happy to help you with that question!"),
//   new HumanMessage("What's 2+2?"),
// ]);
// console.log(`[type] ${continued.type} AIMessage=${AIMessage.isInstance(continued)}`);
// console.log(`[answer] ${continued.text}`);
// const usage = continued.usage_metadata;
// console.log(
//   usage
//     ? `[usage] input=${usage.input_tokens} output=${usage.output_tokens} total=${usage.total_tokens}`
//     : "[usage] unavailable",
// );
// console.log(`[finish] ${finishOf(continued.response_metadata)}`);

console.log("\n== tool message ==");
const getWeather = tool(
  ({ location }) => `It's sunny in ${location}.`,
  {
    name: "get_weather",
    description: "Get the weather at a location. Call this once.",
    schema: z.object({
      location: z.string(),
    }),
  },
);
const modelWithTools = model.bindTools([getWeather]);
const toolCall = await modelWithTools.invoke(
  "What's the weather in San Francisco? Call get_weather once, then stop.",
);
const call = toolCall.tool_calls?.[0];
if (!call?.id) {
  throw new Error(`Model returned no tool call id: ${toolCall.text}`);
}
console.log(`[call] ${call.name} ${JSON.stringify(call.args)} id=${call.id}`);

const toolMessage = new ToolMessage({
  content: "Sunny, 72°F",
  tool_call_id: call.id,
  name: call.name,
  artifact: { document_id: "doc_123", page: 0 },
});
console.log(`[tool] content=${toolMessage.text}`);
console.log(`[artifact] ${JSON.stringify(toolMessage.artifact)}`);

const answered = await modelWithTools.invoke([
  new HumanMessage("What's the weather in San Francisco?"),
  toolCall,
  toolMessage,
]);
console.log(`[answer] ${answered.text}`);

console.log("\n== chunks ==");
let full: AIMessageChunk | null = null;
for await (const chunk of await model.stream("Reply with the single word: chunk")) {
  full = full ? full.concat(chunk) : chunk;
  if (chunk.text.length > 0) process.stdout.write(chunk.text);
}
console.log(`\n[gathered] ${full?.text ?? ""}`);
console.log(
  `[gathered finish] ${full ? finishOf(full.response_metadata) : "absent"}`,
);

console.log("\n== finish reason: length ==");
const short = await docsChatModel({ maxTokens: 16 });
const limited = await short.invoke("Count from 1 to 40, one number per line.");
console.log(`[limited] ${finishOf(limited.response_metadata)}`);
console.log(`[limited text] ${limited.text}`);
