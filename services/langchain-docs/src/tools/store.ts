/**
 * https://docs.langchain.com/oss/javascript/langchain/tools
 * Read and write long-term memory from a tool.
 *
 * The page's prose says `config.store`. `ToolRuntime.store` is typed as the
 * core key-value store (`mget` / `mset`). The store passed to `createAgent`
 * is the namespace store (`get` / `put`), so these tools close over that
 * instance, matching the code sample. The value survives a second invoke
 * that does not share a checkpointer thread.
 */
import { InMemoryStore } from "@langchain/langgraph";
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const store = new InMemoryStore();

const getUserInfo = tool(
  async ({ user_id }) => {
    const item = await store.get(["users"], user_id);
    console.log(`[get] ${user_id} ${JSON.stringify(item?.value ?? null)}`);
    return item ? JSON.stringify(item.value) : "No user info stored.";
  },
  {
    name: "get_user_info",
    description: "Look up user info by user_id. Call this once.",
    schema: z.object({
      user_id: z.string(),
    }),
  },
);

const saveUserInfo = tool(
  async ({ user_id, name, age, email }) => {
    await store.put(["users"], user_id, { name, age, email });
    console.log(`[put] ${user_id} name=${name} age=${age} email=${email}`);
    return "Successfully saved user info.";
  },
  {
    name: "save_user_info",
    description: "Save user info. Call this once.",
    schema: z.object({
      user_id: z.string(),
      name: z.string(),
      age: z.number(),
      email: z.string(),
    }),
  },
);

const agent = createAgent({
  model: docsModel(),
  tools: [getUserInfo, saveUserInfo],
  store,
  systemPrompt:
    "Call the one tool the user asks for, once, with the exact fields in the message. Then answer in one sentence.",
});

await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content:
          "Save the following user and call save_user_info once: user_id abc123, name Foo, age 25, email foo@langchain.dev",
      },
    ],
  },
  { recursionLimit: 8 },
);

const saved = await store.get(["users"], "abc123");
if (!saved) {
  throw new Error("save_user_info did not write to the store");
}
console.log(`[stored] ${JSON.stringify(saved.value)}`);

const result = await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content:
          "Get user info for user with id abc123. Call get_user_info once.",
      },
    ],
  },
  { recursionLimit: 8 },
);
console.log(`[answer] ${result.messages.at(-1)?.text ?? ""}`);
