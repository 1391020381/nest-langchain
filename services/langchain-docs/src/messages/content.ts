/**
 * https://docs.langchain.com/oss/javascript/langchain/messages
 * Message content and standard content blocks.
 *
 * The page's OpenAI example stores a reasoning item in `content`. This
 * version's OpenAI translator reads that summary from
 * `additional_kwargs.reasoning` (or `response_metadata.output` when the
 * Responses payload is present) and drops a `content` block of type
 * "reasoning". The Anthropic `thinking` block still becomes `reasoning`.
 *
 * The multimodal samples on the page use `source_type` / `mime_type`.
 * Those aliases are deprecated here. Standard blocks use `mimeType`,
 * `url`, `data`, or `fileId`. Audio, video, and provider file ids are the
 * same shape; this script does not send them.
 */
import type { ContentBlock } from "langchain";
import { AIMessage, HumanMessage } from "langchain";
import { docsChatModel, docsModelName } from "../models/chat-model";

function describe(blocks: ContentBlock.Standard[]) {
  return blocks
    .map((block) => {
      if (block.type === "text") return `text:${block.text}`;
      if (block.type === "reasoning") return `reasoning:${block.reasoning}`;
      if (block.type === "tool_call") return `tool_call:${block.name}`;
      if (block.type === "image") return "image";
      return block.type;
    })
    .join(" | ");
}

console.log("== content shapes ==");
const asString = new HumanMessage("Hello, how are you?");
const providerNative = new HumanMessage({
  content: [
    { type: "text", text: "Hello, how are you?" },
    {
      type: "image_url",
      image_url: { url: "https://example.com/image.jpg" },
    },
  ],
});
const standard = new HumanMessage({
  contentBlocks: [
    { type: "text", text: "Hello, how are you?" },
    {
      type: "image",
      url: "https://example.com/image.jpg",
      mimeType: "image/jpeg",
    },
  ],
});
console.log(`[string] ${asString.text}`);
console.log(`[provider-native] ${JSON.stringify(providerNative.content)}`);
console.log(`[standard] ${describe(standard.contentBlocks)}`);

console.log("\n== standard content blocks ==");
const anthropic = new AIMessage({
  content: [
    { type: "thinking", thinking: "The user wants a number.", signature: "demo" },
    { type: "text", text: "4" },
  ],
  response_metadata: { model_provider: "anthropic" },
});
const openai = new AIMessage({
  content: [{ type: "text", text: "4" }],
  additional_kwargs: {
    reasoning: { summary: [{ type: "summary_text", text: "Add the numbers." }] },
  },
  response_metadata: { model_provider: "openai" },
});
const withTool = new AIMessage({
  content: "Checking.",
  tool_calls: [{ name: "search", args: { query: "weather" }, id: "call_123" }],
});
console.log(`[anthropic] ${describe(anthropic.contentBlocks)}`);
console.log(`[openai] ${describe(openai.contentBlocks)}`);
console.log(`[tool call] ${describe(withTool.contentBlocks)}`);

const textBlock: ContentBlock.Text = {
  type: "text",
  text: "Hello world",
  annotations: [],
};
const reasoningBlock: ContentBlock.Reasoning = {
  type: "reasoning",
  reasoning: "The user is asking about the weather.",
};
const imageBlock: ContentBlock.Multimodal.Image = {
  type: "image",
  url: "https://example.com/image.png",
  mimeType: "image/png",
};
console.log(
  `[typed] ${textBlock.type}, ${reasoningBlock.type}, ${imageBlock.type}`,
);

console.log("\n== outputVersion v1 ==");
const v1 = await docsChatModel({ maxTokens: 32, outputVersion: "v1" });
const reply = await v1.invoke("Reply with the single word: blocks");
console.log(`[content] ${JSON.stringify(reply.content)}`);
console.log(`[contentBlocks] ${describe(reply.contentBlocks)}`);

console.log("\n== multimodal ==");
const modelName = docsModelName();
const vision = await docsChatModel({ maxTokens: 32 });
if (vision.profile.imageInputs) {
  const seen = await vision.invoke([
    new HumanMessage({
      contentBlocks: [
        { type: "text", text: "What color is this image? One word." },
        {
          type: "image",
          mimeType: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        },
      ],
    }),
  ]);
  console.log(`[image] ${seen.text}`);
} else {
  console.log(
    `[multimodal] skip: ${modelName} profile does not report imageInputs`,
  );
}
