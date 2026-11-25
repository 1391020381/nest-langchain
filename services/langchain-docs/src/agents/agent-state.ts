/**
 * https://docs.langchain.com/oss/javascript/langchain/agents
 * Agent state
 *
 * `stateSchema` accepts a Zod object. `new StateSchema()` needs Standard JSON
 * Schema, which this package's Zod 3.25 does not provide.
 */
import {
  createAgent,
  createMiddleware,
  tool,
  type ToolRuntime,
} from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const MyState = z.object({
  userId: z.string(),
  callCount: z.number().default(0),
});

const getUserInfo = tool(
  async (_, runtime: ToolRuntime<z.infer<typeof MyState>>) => {
    const userId = runtime.state.userId;
    console.log(`[tool] userId=${userId}`);
    return userId === "user_123" ? "John Doe" : "Unknown User";
  },
  {
    name: "get_user_info",
    description: "Look up the current user's name. Call this once.",
    schema: z.object({}),
  },
);

const stateMiddleware = createMiddleware({
  name: "StateExtension",
  stateSchema: MyState,
  beforeModel: (state) => {
    console.log(
      `[middleware] userId=${state.userId} callCount=${state.callCount}`,
    );
    return { callCount: state.callCount + 1 };
  },
});

const agent = createAgent({
  model: docsModel(),
  tools: [getUserInfo],
  middleware: [stateMiddleware],
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "what's my name?" }],
  userId: "user_123",
});

console.log(`[answer] ${result.messages.at(-1)?.content}`);
console.log(`[state] userId=${result.userId} callCount=${result.callCount}`);
