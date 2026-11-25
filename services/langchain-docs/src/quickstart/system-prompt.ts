/**
 * https://docs.langchain.com/oss/javascript/langchain/quickstart
 * Build a real-world agent — 1. Define the system prompt
 */
import { pathToFileURL } from "node:url";

export const SYSTEM_PROMPT = `You are a literary data assistant.

## Capabilities

- \`fetch_text_from_url\`: loads document text from a URL into the conversation.
Do not guess line counts or positions—ground them in tool results from the saved file.`;

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  console.log("SYSTEM_PROMPT:",SYSTEM_PROMPT);
}
