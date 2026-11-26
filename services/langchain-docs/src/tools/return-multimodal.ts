/**
 * https://docs.langchain.com/oss/javascript/langchain/tools
 * Return multimodal content blocks from a tool.
 *
 * Blocks use `mimeType` and `data`. The page's `url` example is the same
 * shape. The model call is skipped when `profile.imageInputs` is false.
 */
import type { ContentBlock } from "langchain";
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";
import { docsChatModel, docsModelName } from "../models/chat-model";

const RED_PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const screenshot: ContentBlock.Standard[] = [
  { type: "text", text: "Screenshot of the current page." },
  { type: "image", mimeType: "image/png", data: RED_PIXEL },
];

const captureScreenshot = tool(async () => screenshot, {
  name: "capture_screenshot",
  description: "Capture a screenshot of the current page. Call this once.",
  schema: z.object({}),
});

const profileModel = await docsChatModel({ maxTokens: 16 });
console.log(`[profileModel] ${JSON.stringify(profileModel)}`);
if (!profileModel.profile.imageInputs) {
  console.log(`[blocks] ${screenshot.map((block) => block.type).join(", ")}`);
  console.log(
    `[multimodal] skip: ${docsModelName()} profile does not report imageInputs`,
  );
} else {
  const agent = createAgent({
    model: docsModel(),
    tools: [captureScreenshot],
    systemPrompt:
      "Call capture_screenshot once, then describe the image in one sentence.",
  });
  const result = await agent.invoke(
    { messages: [{ role: "user", content: "Show me the current page." }] },
    { recursionLimit: 8 },
  );
  const toolMessage = result.messages.find((message) => message.type === "tool");
  if (!toolMessage) {
    throw new Error(
      `Model did not call capture_screenshot. Last: ${result.messages.at(-1)?.text ?? ""}`,
    );
  }
  const blocks = toolMessage.contentBlocks ?? [];
  console.log(
    `[blocks] ${blocks.map((block) => block.type).join(", ") || "none"}`,
  );
  console.log(`[answer] ${result.messages.at(-1)?.text ?? ""}`);
}
