const examples = [
  {
    script: "bun run quickstart",
    file: "src/quickstart/basic-agent.ts",
    doc: "https://docs.langchain.com/oss/javascript/langchain/quickstart",
  },
];

console.log("LangChain 官网示例\n");
for (const example of examples) {
  console.log(`${example.script}`);
  console.log(`  ${example.file}`);
  console.log(`  ${example.doc}\n`);
}
