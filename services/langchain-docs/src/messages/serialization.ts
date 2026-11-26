/**
 * https://docs.langchain.com/oss/javascript/langchain/messages
 * Serialize with toJSON and restore with load.
 *
 * load() instantiates classes from the payload. This script only loads
 * the object it just serialized.
 */
import { load } from "@langchain/core/load";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

const human = new HumanMessage({
  content: "What is the capital of France?",
  name: "alice",
  id: "msg_123",
});
const humanJson = human.toJSON();
console.log(`[human json] ${JSON.stringify(humanJson)}`);

const restoredHuman = await load<HumanMessage>(JSON.stringify(humanJson));
console.log(`[human id] ${humanJson.id.join("/")}`);
console.log(
  `[human] type=${restoredHuman.type} name=${restoredHuman.name} id=${restoredHuman.id} text=${restoredHuman.text}`,
);

const ai = new AIMessage({
  content: "",
  tool_calls: [
    {
      name: "get_weather",
      args: { location: "San Francisco" },
      id: "call_123",
    },
  ],
});
const restoredAi = await load<AIMessage>(JSON.stringify(ai.toJSON()));
console.log(`[ai] ${JSON.stringify(restoredAi.tool_calls)}`);

const tool = new ToolMessage({
  content: "It was the best of times, it was the worst of times.",
  tool_call_id: "call_123",
  name: "search_books",
  artifact: { document_id: "doc_123", page: 0 },
});
const restoredTool = await load<ToolMessage>(JSON.stringify(tool.toJSON()));
console.log(
  `[tool] name=${restoredTool.name} id=${restoredTool.tool_call_id} text=${restoredTool.text}`,
);
console.log(`[artifact] ${JSON.stringify(restoredTool.artifact)}`);
