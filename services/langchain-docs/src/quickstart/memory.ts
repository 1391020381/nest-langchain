/**
 * https://docs.langchain.com/oss/javascript/langchain/quickstart
 * Build a real-world agent — 4. Add memory
 */
import { MemorySaver, emptyCheckpoint } from "@langchain/langgraph";
import { pathToFileURL } from "node:url";

export const checkpointer = new MemorySaver();

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const config = {
    configurable: { thread_id: "quickstart", checkpoint_ns: "" },
  };
  const checkpoint = emptyCheckpoint();
  checkpoint.channel_values = { note: "saved in memory" };
  const saved = await checkpointer.put(config, checkpoint, {
    source: "update",
    step: 0,
    parents: {},
  });
  const tuple = await checkpointer.getTuple(saved);
  console.log(tuple?.checkpoint.channel_values);
}
