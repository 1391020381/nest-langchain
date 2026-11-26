/**
 * https://docs.langchain.com/oss/javascript/langchain/models
 * Advanced: token usage, invocation config, dynamic model selection.
 * Multimodal and reasoning run only when model.profile reports support.
 */
import { createAgent, createMiddleware } from "langchain";
import { docsChatModel, docsModelName } from "./chat-model";

const modelName = docsModelName();
const model = await docsChatModel({ maxTokens: 64 });

const profileFlags = Object.entries(model.profile)
  .filter(([, value]) => value === true || typeof value === "number")
  .map(([key, value]) => `${key}=${value}`)
  .join(" ");
console.log(`[profile] ${profileFlags || "empty"}`);

console.log("\n== token usage / invocation config ==");
const counted = await model.invoke("Reply with the single word: ok", {
  runName: "token_usage",
  tags: ["demo"],
  metadata: { user_id: "123" },
  callbacks: [
    {
      handleChatModelStart(
        _llm,
        _messages,
        _runId,
        _parentRunId,
        _extraParams,
        tags,
        metadata,
        runName,
      ) {
        console.log(
          `[config] runName=${runName} tags=${tags?.join(",") ?? ""} user_id=${String(metadata?.user_id ?? "")}`,
        );
      },
    },
  ],
});
const usage = counted.usage_metadata;
console.log(`[answer] ${counted.text}`);
console.log(
  usage
    ? `[usage] input=${usage.input_tokens} output=${usage.output_tokens} total=${usage.total_tokens}`
    : "[usage] unavailable",
);

console.log("\n== multimodal ==");
if (model.profile.imageInputs) {
  const seen = await model.invoke([
    {
      role: "user",
      content: [
        { type: "text", text: "What color is this image? One word." },
        {
          type: "image",
          mimeType: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        },
      ],
    },
  ]);
  console.log(`[image] ${seen.text}`);
} else {
  console.log(
    `[multimodal] skip: ${modelName} profile does not report imageInputs`,
  );
}

console.log("\n== reasoning ==");
if (model.profile.reasoningOutput) {
  const reasoned = await model.invoke(
    "Why is the sky blue? Answer in one sentence.",
  );
  const steps = reasoned.contentBlocks.filter((block) => block.type === "reasoning");
  console.log(
    steps.length > 0
      ? `[reasoning] ${steps.map((step) => step.reasoning).join(" ")}`
      : `[reasoning] profile reports reasoningOutput, but this response had no reasoning block`,
  );
  console.log(`[answer] ${reasoned.text}`);
} else {
  console.log(
    `[reasoning] skip: ${modelName} profile does not report reasoningOutput`,
  );
}

console.log("\n== dynamic model ==");
const basicModel = await docsChatModel({ maxTokens: 32 });
const advancedModel = await docsChatModel({ maxTokens: 32 });
const dynamicModelSelection = createMiddleware({
  name: "DynamicModelSelection",
  wrapModelCall: (request, handler) => {
    const messageCount = request.messages.length;
    const advanced = messageCount > 10;
    console.log(
      `[select] messages=${messageCount} model=${advanced ? "advanced" : "basic"}`,
    );
    return handler({
      ...request,
      model: advanced ? advancedModel : basicModel,
    });
  },
});
const agent = createAgent({
  model: basicModel,
  tools: [],
  systemPrompt: "Reply with exactly the single word the user asks for.",
  middleware: [dynamicModelSelection],
});

const short = await agent.invoke({
  messages: [{ role: "user", content: "Reply with the single word: basic" }],
});
console.log(`[basic] ${short.messages.at(-1)?.text ?? ""}`);

const longThread: Array<{ role: "user" | "assistant"; content: string }> = [];
for (let i = 0; i < 6; i += 1) {
  longThread.push({ role: "user", content: `Remember ${i}` });
  longThread.push({ role: "assistant", content: String(i) });
}
longThread.push({
  role: "user",
  content: "Reply with the single word: advanced",
});
const long = await agent.invoke({ messages: longThread });
console.log(`[advanced] ${long.messages.at(-1)?.text ?? ""}`);
