/**
 * https://docs.langchain.com/oss/javascript/langchain/tools
 * Read invocation context, execution info, server info, and the stream writer.
 *
 * `executionInfo` and `serverInfo` are LangGraph runtime fields. They are not
 * declared on `ToolRuntime`. `serverInfo` stays empty unless Agent Server
 * injects an assistant id, graph id, or authenticated user.
 * `writer` only emits when the stream includes `custom`.
 */
import { MemorySaver } from "@langchain/langgraph";
import { createAgent, tool, type ToolRuntime } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

type GraphRuntime = ToolRuntime & {
  executionInfo?: {
    threadId?: string;
    runId?: string;
    nodeAttempt?: number;
  };
  serverInfo?: {
    assistantId?: string;
    graphId?: string;
    user?: { identity?: string };
  } | null;
};

const model = docsModel();

console.log("== context ==");
const contextSchema = z.object({
  user_name: z.string(),
});
const getUserName = tool(
  (_, runtime: ToolRuntime<unknown, z.infer<typeof contextSchema>>) => {
    const name = runtime.context.user_name;
    console.log(`[context] user_name=${name}`);
    return name;
  },
  {
    name: "get_user_name",
    description: "Get the user's name. Call this once.",
    schema: z.object({}),
  },
);
const contextAgent = createAgent({
  model,
  tools: [getUserName],
  checkpointer: new MemorySaver(),
  contextSchema,
  systemPrompt:
    "Call get_user_name once, then answer with only the name it returns.",
});
const thread = {
  configurable: { thread_id: "tools-context" },
  context: { user_name: "John Smith" },
  recursionLimit: 8,
};
let named = await contextAgent.invoke(
  { messages: [{ role: "user", content: "What is my name?" }] },
  thread,
);
console.log(`[answer] ${named.messages.at(-1)?.text ?? ""}`);
named = await contextAgent.invoke(
  { messages: [{ role: "user", content: "What was my name again?" }] },
  thread,
);
console.log(`[thread] ${named.messages.at(-1)?.text ?? ""}`);

console.log("\n== execution, server, writer ==");
const logExecutionContext = tool(
  (_input, runtime: GraphRuntime) => {
    const info = runtime.executionInfo;
    if (!info) return "execution info unavailable";
    console.log(
      `[execution] thread=${info.threadId ?? "(none)"} run=${info.runId ?? "(none)"} attempt=${info.nodeAttempt ?? ""}`,
    );
    return `thread ${info.threadId ?? "none"}`;
  },
  {
    name: "log_execution_context",
    description: "Log execution identity information. Call this once.",
    schema: z.object({}),
  },
);
const getAssistantScopedData = tool(
  (_input, runtime: GraphRuntime) => {
    const server = runtime.serverInfo;
    if (server?.assistantId || server?.graphId || server?.user) {
      console.log(
        `[server] assistant=${server.assistantId ?? ""} graph=${server.graphId ?? ""} user=${server.user?.identity ?? ""}`,
      );
      return "server info available";
    }
    console.log("[server] unavailable (not running on Agent Server)");
    return "server info unavailable";
  },
  {
    name: "get_assistant_scoped_data",
    description: "Fetch data scoped to the current assistant. Call this once.",
    schema: z.object({}),
  },
);
const getWeather = tool(
  ({ city }, runtime: ToolRuntime) => {
    runtime.writer?.(`Looking up data for city: ${city}`);
    runtime.writer?.(`Acquired data for city: ${city}`);
    return `It's always sunny in ${city}!`;
  },
  {
    name: "get_weather",
    description: "Get weather for a given city. Call this once.",
    schema: z.object({ city: z.string() }),
  },
);
const infoAgent = createAgent({
  model,
  tools: [logExecutionContext, getAssistantScopedData, getWeather],
  systemPrompt:
    "Call log_execution_context once, get_assistant_scoped_data once, and get_weather once for Paris. Then answer in one sentence.",
});

function streamEvent(event: unknown): { mode: string; chunk: unknown } | undefined {
  if (!Array.isArray(event)) return undefined;
  if (typeof event[0] === "string") return { mode: event[0], chunk: event[1] };
  if (Array.isArray(event[0]) && typeof event[1] === "string") {
    return { mode: event[1], chunk: event[2] };
  }
  return undefined;
}

function textOf(message: { text?: string; content?: unknown }) {
  if (typeof message.text === "string" && message.text.length > 0) {
    return message.text;
  }
  return typeof message.content === "string" ? message.content : "";
}

const stream = await infoAgent.stream(
  {
    messages: [
      {
        role: "user",
        content: "Log this run, check the assistant, and get the weather in Paris.",
      },
    ],
  },
  {
    streamMode: ["custom", "values"],
    configurable: { thread_id: "tools-runtime" },
    recursionLimit: 12,
  },
);

const custom: string[] = [];
let answer = "";
for await (const event of stream) {
  const parsed = streamEvent(event);
  if (!parsed) {
    console.log(`[event] ${JSON.stringify(event).slice(0, 180)}`);
    continue;
  }
  if (parsed.mode === "custom") {
    custom.push(String(parsed.chunk));
    console.log(`[custom] ${String(parsed.chunk)}`);
  } else if (
    parsed.mode === "values" &&
    parsed.chunk &&
    typeof parsed.chunk === "object" &&
    "messages" in parsed.chunk &&
    Array.isArray(parsed.chunk.messages)
  ) {
    const last = parsed.chunk.messages.at(-1) as
      | { text?: string; content?: unknown }
      | undefined;
    if (last) answer = textOf(last);
  }
}
if (custom.length === 0) {
  throw new Error("stream writer produced no custom chunks");
}
console.log(`[answer] ${answer}`);
