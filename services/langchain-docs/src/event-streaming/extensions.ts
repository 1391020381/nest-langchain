/**
 * https://docs.langchain.com/oss/javascript/langchain/event-streaming
 * Custom updates
 *
 * The page's `toolActivityTransformer` reads `tools` events. `tool-finished`
 * does not include `tool_name`, so the name is remembered from `tool-started`.
 * The published sample maps every non-error event to "started"; this run
 * keeps the channel's started / finished / error statuses.
 *
 * Message events on this version are model chunks, not `content-block-delta`
 * envelopes. The call-time transformer counts text on those chunks. The
 * langgraph projection guide reads `data.usage.output_tokens`.
 *
 * Middleware registers the tool-activity transformer. The stats transformer
 * is passed to `streamEvents`, which is the call-time registration path.
 */
import {
  StreamChannel,
  type ProtocolEvent,
  type StreamTransformer,
} from "@langchain/langgraph";
import { createAgent, createMiddleware, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";
import { repairEmptyToolNames } from "./tool-names";

type Activity = {
  name: string;
  status: "started" | "finished" | "error";
};

function textFromMessagesData(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as {
    event?: string;
    delta?: { type?: string; text?: string };
    content?: unknown;
  };
  if (record.event === "content-block-delta" && record.delta?.type === "text-delta") {
    return record.delta.text ?? "";
  }
  if (typeof record.content === "string") return record.content;
  if (!Array.isArray(record.content)) return "";
  return record.content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const typed = block as { type?: string; text?: string };
      return typed.type === "text" ? (typed.text ?? "") : "";
    })
    .join("");
}

function toolActivityTransformer(): StreamTransformer<{ toolActivity: StreamChannel<Activity> }> {
  const activity = new StreamChannel<Activity>("toolActivity");
  const names = new Map<string, string>();
  return {
    init: () => ({ toolActivity: activity }),
    process(event: ProtocolEvent) {
      if (event.method !== "tools") return true;
      const data = event.params.data as {
        tool_name?: string;
        tool_call_id?: string;
        event?: string;
      };
      if (data.tool_call_id && data.tool_name) {
        names.set(data.tool_call_id, data.tool_name);
      }
      const name =
        data.tool_name ?? (data.tool_call_id ? names.get(data.tool_call_id) : undefined);
      const status =
        data.event === "tool-error"
          ? "error"
          : data.event === "tool-finished"
            ? "finished"
            : data.event === "tool-started"
              ? "started"
              : undefined;
      if (name && status) activity.push({ name, status });
      return true;
    },
  };
}

function statsTransformer(): StreamTransformer<{ textChars: Promise<number> }> {
  let textChars = 0;
  let sample: unknown;
  let resolveTotal!: (value: number) => void;
  let rejectTotal!: (reason: unknown) => void;
  const textCharsPromise = new Promise<number>((resolve, reject) => {
    resolveTotal = resolve;
    rejectTotal = reject;
  });
  return {
    init: () => ({ textChars: textCharsPromise }),
    process(event: ProtocolEvent) {
      if (event.method !== "messages") return true;
      if (sample === undefined) sample = event.params.data;
      textChars += textFromMessagesData(event.params.data).length;
      return true;
    },
    finalize: () => resolveTotal(textChars),
    fail: (error) => rejectTotal(error),
  };
}

const getWeather = tool(
  async ({ city }) => `It's always sunny in ${city}!`,
  {
    name: "get_weather",
    description: "Get weather for a city. Call this once.",
    schema: z.object({ city: z.string() }),
  },
);

const toolActivityMiddleware = createMiddleware({
  name: "ToolActivityMiddleware",
  streamTransformers: [toolActivityTransformer],
});

const agent = createAgent({
  model: docsModel(),
  tools: [getWeather],
  systemPrompt: "Call get_weather once, then answer in one sentence.",
  middleware: [repairEmptyToolNames("get_weather"), toolActivityMiddleware],
});

const stream = await agent.streamEvents(
  { messages: [{ role: "user", content: "What is the weather in SF?" }] },
  { version: "v3", recursionLimit: 8, transformers: [statsTransformer] },
);

const extensions = stream.extensions as typeof stream.extensions & {
  textChars?: Promise<number>;
};
console.log(`[extensions] ${Object.keys(stream.extensions).join(", ")}`);
if (!extensions.toolActivity || !extensions.textChars) {
  throw new Error(
    `missing projection (${Object.keys(stream.extensions).join(", ") || "none"})`,
  );
}

const activities: Activity[] = [];
const textChars = await Promise.all([
  extensions.textChars,
  (async () => {
    for await (const entry of extensions.toolActivity) {
      activities.push(entry);
      console.log(`[activity] ${entry.status} ${entry.name}`);
    }
  })(),
  stream.output,
]).then(([chars]) => chars);

console.log(`[textChars] ${textChars}`);
const started = activities.some(
  (entry) => entry.name === "get_weather" && entry.status === "started",
);
const finished = activities.some(
  (entry) => entry.name === "get_weather" && entry.status === "finished",
);
if (!started || !finished || textChars < 1) {
  throw new Error(
    `custom projection missed the tool lifecycle or the text (activities=${activities.length}, textChars=${textChars})`,
  );
}
