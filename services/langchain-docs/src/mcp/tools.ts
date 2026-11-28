/**
 * https://docs.langchain.com/oss/javascript/langchain/mcp/tools
 * MCPAdapter turns a server's tools into LangChain tools for createAgent.
 * The public docs server needs no API key. This script lists them and stops
 * before a model call.
 */
import { MCPAdapter } from "@langchain/mcp-adapters";
import { createAgent } from "langchain";
import { docsModel } from "../model";

const adapter = new MCPAdapter({
  servers: { docs: { url: "https://docs.langchain.com/mcp" } },
});

try {
  const tools = await adapter.listTools();
  const names = tools.map((item) => item.name);
  console.log(names.join("\n"));
  if (names.length === 0) {
    throw new Error("docs server returned no tools");
  }
  createAgent({ model: docsModel(), tools });
  console.log(`[tools] ${names.length}`);
} finally {
  await adapter.close();
}
