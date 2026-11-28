/**
 * https://docs.langchain.com/oss/javascript/langchain/long-term-memory
 * store keeps a value across thread_id. checkpointer keeps each thread separate.
 *
 * The profile is written on the store directly. Two threads then read it
 * through the same tool, so the recall does not depend on conversation state.
 */
import { InMemoryStore, MemorySaver } from "@langchain/langgraph";
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const store = new InMemoryStore();
await store.put(["users"], "ada", { name: "Ada" });

const getUser = tool(
  async ({ user_id }) => {
    const item = await store.get(["users"], user_id);
    const name = (item?.value as { name?: string } | undefined)?.name;
    console.log(`[get] thread value name=${name ?? "missing"}`);
    return name ? `name=${name}` : "No user stored.";
  },
  {
    name: "get_user",
    description: "Look up a stored user by user_id. Call this once.",
    schema: z.object({ user_id: z.string() }),
  },
);

const agent = createAgent({
  model: docsModel(),
  tools: [getUser],
  store,
  checkpointer: new MemorySaver(),
  systemPrompt: "Call get_user once with the user_id in the message. Then reply with only the name.",
});

async function readOnThread(threadId: string) {
  const result = await agent.invoke(
    {
      messages: [{ role: "user", content: "Look up user_id ada. Call get_user once." }],
    },
    { configurable: { thread_id: threadId }, recursionLimit: 8 },
  );
  const toolMessage = result.messages.find((message) => message.type === "tool");
  if (!toolMessage?.text?.includes("name=Ada")) {
    throw new Error(`${threadId} did not read Ada from the store`);
  }
  console.log(`[${threadId}] ${toolMessage.text}`);
}

await readOnThread("thread-a");
await readOnThread("thread-b");
