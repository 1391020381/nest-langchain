/**
 * https://docs.langchain.com/oss/javascript/langchain/tools
 * Filter registered tools from state or context, and register a tool at runtime.
 *
 * The filtering samples on the page use `createDeepAgent`. The same
 * `wrapModelCall` hook works on `createAgent`. The first model step sets
 * `toolChoice` to `"required"` so the model has to call one of the tools
 * left after filtering. Runtime registration still needs `wrapToolCall`,
 * because the tool is not in the original tool list.
 */
import { AIMessage } from "@langchain/core/messages";
import type { ClientTool, ServerTool } from "@langchain/core/tools";
import { createAgent, createMiddleware, tool } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

function toolName(candidate: ClientTool | ServerTool) {
  if ("name" in candidate && typeof candidate.name === "string") {
    return candidate.name;
  }
  return "";
}

function calledTools(result: { messages: readonly unknown[] }) {
  return result.messages.flatMap((message) => {
    if (!AIMessage.isInstance(message)) return [];
    return (message.tool_calls ?? []).map((call) => call.name);
  });
}

function formatCalls(names: string[]) {
  return [...new Set(names)].join(", ") || "nothing";
}

const model = docsModel();

console.log("== filter by state ==");
const AuthState = z.object({
  authenticated: z.boolean().default(false),
});
const publicSearch = tool(
  ({ query }) => `Public results for ${query}`,
  {
    name: "public_search",
    description: "Search public information.",
    schema: z.object({ query: z.string() }),
  },
);
const privateNotes = tool(
  ({ query }) => `Private notes for ${query}`,
  {
    name: "private_notes",
    description: "Search private notes. Only available after authentication.",
    schema: z.object({ query: z.string() }),
  },
);
const stateBasedTools = createMiddleware({
  name: "StateBasedTools",
  stateSchema: AuthState,
  wrapModelCall: (request, handler) => {
    const authenticated = request.state.authenticated === true;
    const filtered = authenticated
      ? request.tools
      : request.tools.filter((item) => toolName(item).startsWith("public_"));
    const called = request.messages.some((message) => message.type === "tool");
    const names = filtered.map(toolName);
    if (authenticated) {
      if (!names.includes("private_notes")) {
        throw new Error("private_notes missing for an authenticated caller");
      }
    } else if (names.includes("private_notes")) {
      throw new Error("private_notes leaked to an unauthenticated caller");
    }
    console.log(
      `[state] authenticated=${authenticated} tools=${names.join(",")}`,
    );
    return handler({
      ...request,
      tools: filtered,
      toolChoice: called ? "auto" : "required",
    });
  },
});
const stateAgent = createAgent({
  model,
  tools: [publicSearch, privateNotes],
  middleware: [stateBasedTools],
  systemPrompt:
    "Call exactly one tool. If private_notes is available, call private_notes. Otherwise call public_search. Then answer in one sentence.",
});

const guest = await stateAgent.invoke(
  {
    messages: [{ role: "user", content: "Search notes for the launch plan." }],
    authenticated: false,
  },
  { recursionLimit: 8 },
);
const guestCalls = calledTools(guest);
console.log(`[guest] called ${formatCalls(guestCalls)}`);
if (guestCalls.includes("private_notes") || guestCalls.length === 0) {
  throw new Error(
    `unauthenticated caller should use public_search, called ${formatCalls(guestCalls)}`,
  );
}

const member = await stateAgent.invoke(
  {
    messages: [{ role: "user", content: "Search notes for the launch plan." }],
    authenticated: true,
  },
  { recursionLimit: 8 },
);
const memberCalls = calledTools(member);
console.log(`[member] called ${formatCalls(memberCalls)}`);
const memberAllowed = new Set(["public_search", "private_notes"]);
if (
  memberCalls.length === 0 ||
  memberCalls.some((name) => !memberAllowed.has(name))
) {
  throw new Error(
    `authenticated caller should use a visible tool, called ${formatCalls(memberCalls)}`,
  );
}

console.log("\n== filter by context ==");
const contextSchema = z.object({
  userRole: z.enum(["admin", "reader"]),
});
const readStatus = tool(
  ({ order_id }) => `Order ${order_id} is shipped.`,
  {
    name: "read_status",
    description: "Read an order status.",
    schema: z.object({ order_id: z.string() }),
  },
);
const deleteData = tool(
  ({ order_id }) => `Deleted order ${order_id}.`,
  {
    name: "delete_data",
    description: "Delete an order. Admins only.",
    schema: z.object({ order_id: z.string() }),
  },
);
const contextBasedTools = createMiddleware({
  name: "ContextBasedTools",
  contextSchema,
  wrapModelCall: (request, handler) => {
    const userRole = request.runtime.context?.userRole;
    const filtered =
      userRole === "admin"
        ? request.tools
        : request.tools.filter((item) => toolName(item).startsWith("read_"));
    const called = request.messages.some((message) => message.type === "tool");
    const names = filtered.map(toolName);
    if (userRole === "admin") {
      if (!names.includes("delete_data") || !names.includes("read_status")) {
        throw new Error(`admin tool list is ${names.join(",") || "empty"}`);
      }
    } else if (names.includes("delete_data") || !names.includes("read_status")) {
      throw new Error(`reader tool list is ${names.join(",") || "empty"}`);
    }
    console.log(`[context] role=${userRole ?? ""} tools=${names.join(",")}`);
    return handler({
      ...request,
      tools: filtered,
      toolChoice: called ? "auto" : "required",
    });
  },
});
const roleAgent = createAgent({
  model,
  tools: [readStatus, deleteData],
  middleware: [contextBasedTools],
  systemPrompt:
    "Call exactly one tool. If delete_data is available, call delete_data for the order. Otherwise call read_status. Then answer in one sentence.",
});

const reader = await roleAgent.invoke(
  { messages: [{ role: "user", content: "Handle order 7." }] },
  { context: { userRole: "reader" }, recursionLimit: 8 },
);
const readerCalls = calledTools(reader);
console.log(`[reader] called ${formatCalls(readerCalls)}`);
if (readerCalls.includes("delete_data") || readerCalls.length === 0) {
  throw new Error(
    `reader should use read_status, called ${formatCalls(readerCalls)}`,
  );
}

const admin = await roleAgent.invoke(
  { messages: [{ role: "user", content: "Handle order 7." }] },
  { context: { userRole: "admin" }, recursionLimit: 8 },
);
const adminCalls = calledTools(admin);
console.log(`[admin] called ${formatCalls(adminCalls)}`);
console.log(`[answer] ${admin.messages.at(-1)?.text ?? ""}`);
const allowed = new Set(["read_status", "delete_data"]);
if (
  adminCalls.length === 0 ||
  adminCalls.some((name) => !allowed.has(name))
) {
  throw new Error(
    `admin should call one of the visible tools, called ${formatCalls(adminCalls)}`,
  );
}

console.log("\n== register at runtime ==");
const getWeather = tool(
  ({ city }) => `It's always sunny in ${city}!`,
  {
    name: "get_weather",
    description: "Get weather for a city.",
    schema: z.object({ city: z.string() }),
  },
);
const calculateTip = tool(
  ({ billAmount, tipPercentage }) => {
    const tip = billAmount * (tipPercentage / 100);
    return `Tip: $${tip.toFixed(2)}, Total: $${(billAmount + tip).toFixed(2)}`;
  },
  {
    name: "calculate_tip",
    description: "Calculate the tip amount for a bill",
    schema: z.object({
      billAmount: z.number(),
      tipPercentage: z.number().default(20),
    }),
  },
);
const dynamicToolMiddleware = createMiddleware({
  name: "DynamicToolMiddleware",
  wrapModelCall: (request, handler) => {
    const tools = [...request.tools, calculateTip];
    console.log(`[register] tools=${tools.map(toolName).join(",")}`);
    return handler({ ...request, tools });
  },
  wrapToolCall: (request, handler) => {
    if (request.toolCall.name === "calculate_tip") {
      console.log("[register] execute calculate_tip");
      return handler({ ...request, tool: calculateTip });
    }
    return handler(request);
  },
});
const dynamicAgent = createAgent({
  model,
  tools: [getWeather],
  middleware: [dynamicToolMiddleware],
  systemPrompt:
    "Call calculate_tip once for the bill in the question. Do not call get_weather. Then answer in one sentence.",
});
const tip = await dynamicAgent.invoke(
  {
    messages: [{ role: "user", content: "Calculate a 20% tip on 85 dollars." }],
  },
  { recursionLimit: 8 },
);
const tipCalls = calledTools(tip);
console.log(`[called] ${tipCalls.join(", ") || "nothing"}`);
if (!tipCalls.includes("calculate_tip")) {
  throw new Error(
    `Expected calculate_tip, called ${tipCalls.join(", ") || "nothing"}`,
  );
}
console.log(`[answer] ${tip.messages.at(-1)?.text ?? ""}`);
