/**
 * https://docs.langchain.com/oss/javascript/langchain/mcp/connections
 * One adapter holds a map of named servers. Tool names are prefixed with the
 * server key. close() drops the clients so a later listTools() connects again.
 */
import { MCPAdapter } from "@langchain/mcp-adapters";

const adapter = new MCPAdapter({
  servers: {
    docs: { url: "https://docs.langchain.com/mcp" },
  },
});

try {
  const tools = await adapter.listTools("docs");
  const names = tools.map((item) => item.name);
  console.log(names.join("\n"));
  if (!names.some((name) => name.startsWith("docs_"))) {
    throw new Error(`expected the docs server prefix, got ${names.join(", ")}`);
  }
  console.log(`[server] docs tools=${names.length}`);
} finally {
  await adapter.close();
}
