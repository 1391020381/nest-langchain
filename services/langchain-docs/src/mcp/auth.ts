/**
 * https://docs.langchain.com/oss/javascript/langchain/mcp/auth
 * A bearer token is a header on the HTTP connection. The public docs server
 * does not check it; a private server reads Authorization from this field.
 * authProvider is the OAuth 2.1 alternative on the same connection object.
 */
import { MCPAdapter } from "@langchain/mcp-adapters";

const adapter = new MCPAdapter({
  servers: {
    docs: {
      url: "https://docs.langchain.com/mcp",
      headers: { Authorization: "Bearer public-docs" },
    },
  },
});

try {
  const tools = await adapter.listTools();
  if (tools.length === 0) {
    throw new Error("authenticated connection returned no tools");
  }
  console.log(`[auth] header accepted, tools=${tools.length}`);
} finally {
  await adapter.close();
}
