const examples = [
  {
    script: "bun run quickstart",
    file: "src/quickstart/basic-agent.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/quickstart",
  },
  {
    script: "bun run quickstart:system-prompt",
    file: "src/quickstart/system-prompt.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/quickstart",
  },
  {
    script: "bun run quickstart:fetch-text-from-url",
    file: "src/quickstart/fetch-text-from-url.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/quickstart",
  },
  {
    script: "bun run quickstart:model",
    file: "src/quickstart/model.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/quickstart",
  },
  {
    script: "bun run quickstart:memory",
    file: "src/quickstart/memory.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/quickstart",
  },
  {
    script: "bun run quickstart:research-agent",
    file: "src/quickstart/research-agent.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/quickstart",
  },
  {
    script: "bun run agents:system-prompt",
    file: "src/agents/system-prompt.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/agents",
  },
  {
    script: "bun run agents:structured-output",
    file: "src/agents/structured-output.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/agents",
  },
  {
    script: "bun run agents:agent-state",
    file: "src/agents/agent-state.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/agents",
  },
  {
    script: "bun run agents:invocation",
    file: "src/agents/invocation.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/agents",
  },
  {
    script: "bun run agents:streaming",
    file: "src/agents/streaming.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/agents",
  },
  {
    script: "bun run models:init",
    file: "src/models/init.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/models",
  },
  {
    script: "bun run models:invocation",
    file: "src/models/invocation.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/models",
  },
  {
    script: "bun run models:tool-calling",
    file: "src/models/tool-calling.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/models",
  },
  {
    script: "bun run models:structured-output",
    file: "src/models/structured-output.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/models",
  },
  {
    script: "bun run models:advanced",
    file: "src/models/advanced.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/models",
  },
  {
    script: "bun run messages:basic",
    file: "src/messages/basic.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/messages",
  },
  {
    script: "bun run messages:types",
    file: "src/messages/types.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/messages",
  },
  {
    script: "bun run messages:content",
    file: "src/messages/content.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/messages",
  },
  {
    script: "bun run messages:notifications",
    file: "src/messages/notifications.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/messages",
  },
  {
    script: "bun run messages:serialization",
    file: "src/messages/serialization.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/messages",
  },
  {
    script: "bun run tools:return-string",
    file: "src/tools/return-string.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/tools",
  },
  {
    script: "bun run tools:return-object",
    file: "src/tools/return-object.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/tools",
  },
  {
    script: "bun run tools:return-multimodal",
    file: "src/tools/return-multimodal.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/tools",
  },
  {
    script: "bun run tools:return-command",
    file: "src/tools/return-command.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/tools",
  },
  {
    script: "bun run tools:return-direct",
    file: "src/tools/return-direct.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/tools",
  },
  {
    script: "bun run tools:context",
    file: "src/tools/context.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/tools",
  },
  {
    script: "bun run tools:store",
    file: "src/tools/store.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/tools",
  },
  {
    script: "bun run tools:errors",
    file: "src/tools/errors.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/tools",
  },
  {
    script: "bun run tools:dynamic",
    file: "src/tools/dynamic.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/tools",
  },
  {
    script: "bun run memory:checkpointer",
    file: "src/short-term-memory/checkpointer.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/short-term-memory",
  },
  {
    script: "bun run memory:thread",
    file: "src/short-term-memory/thread.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/short-term-memory",
  },
  {
    script: "bun run memory:trim",
    file: "src/short-term-memory/trim.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/short-term-memory",
  },
];

console.log("LangChain 官网示例\n");
for (const example of examples) {
  console.log(`${example.script}`);
  console.log(`  ${example.file}`);
  console.log(`  ${example.doc}\n`);
}
