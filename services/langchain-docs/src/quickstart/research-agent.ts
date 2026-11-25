/**
 * https://docs.langchain.com/oss/javascript/langchain/quickstart
 * Build a real-world agent — 5. Create and run the agent
 */
import { createDeepAgent } from "deepagents";
import { createAgent } from "langchain";
import { pathToFileURL } from "node:url";
import { fetchTextFromUrl } from "./fetch-text-from-url";
import { checkpointer } from "./memory";
import { model } from "./model";
import { SYSTEM_PROMPT } from "./system-prompt";

const content = `Project Gutenberg hosts a full plain-text copy of F. Scott Fitzgerald's The Great Gatsby.
    URL: https://www.gutenberg.org/files/64317/64317-0.txt

    Answer as much as you can:

    1) How many lines in the complete Gutenberg file contain the substring \`Gatsby\` (count lines, not occurrences within a line, each line ends with a line break).
    2) The 1-based line number of the first line in the file that contains \`Daisy\`.
    3) A two-sentence neutral synopsis.

    Do your best on (1) and (2). If at any point you realize you cannot **verify** an exact answer with
    your available tools and reasoning, do not fabricate numbers: use \`null\` for that field and spell out
    the limitation in \`how_you_computed_counts\`. If you encounter any errors please report what the error was and what the error message was.`;

async function main() {
  const agent = createAgent({
    model,
    tools: [fetchTextFromUrl],
    systemPrompt: SYSTEM_PROMPT,
    checkpointer,
  });

  const deepAgent = createDeepAgent({
    model,
    tools: [fetchTextFromUrl],
    systemPrompt: SYSTEM_PROMPT,
    checkpointer,
  });

  console.log("Running createAgent...");
  const agentResult = await agent.invoke(
    { messages: [{ role: "user", content }] },
    { configurable: { thread_id: "great-gatsby-lc" } },
  );
  console.log("Running createDeepAgent...");
  const deepAgentResult = await deepAgent.invoke(
    { messages: [{ role: "user", content }] },
    { configurable: { thread_id: "great-gatsby-da" } },
  );

  const agentMessages = agentResult.messages;
  const deepMessages = deepAgentResult.messages;
  console.log("\ncreateAgent:");
  console.log(agentMessages[agentMessages.length - 1]?.contentBlocks);
  console.log("\ncreateDeepAgent:");
  console.log(deepMessages[deepMessages.length - 1]?.contentBlocks);
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
