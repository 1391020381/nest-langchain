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
];

console.log("LangChain 官网示例\n");
for (const example of examples) {
  console.log(`${example.script}`);
  console.log(`  ${example.file}`);
  console.log(`  ${example.doc}\n`);
}
