/**
 * streamEvents v3 installs StreamProtocolMessagesHandler and sets
 * `lc_prefer_chat_model_stream_events`. On this OpenAI-compatible model that
 * content-block stream keeps tool arguments and drops the tool name, so the
 * tool node reports `"" is not a valid tool` and the run hits the recursion
 * limit. `streamMode: "messages"` still receives the name.
 *
 * Each of these examples binds one tool, so an empty name is filled with that
 * tool before the tool node runs. A name still present on the raw OpenAI
 * `additional_kwargs.tool_calls` entry wins over the fallback.
 */
import { AIMessage, type ToolCall } from "@langchain/core/messages";
import { createMiddleware } from "langchain";

function rawToolName(message: AIMessage, index: number): string | undefined {
  const raw = message.additional_kwargs.tool_calls;
  if (!Array.isArray(raw)) return undefined;
  const entry = raw[index] as { function?: { name?: string } } | undefined;
  const name = entry?.function?.name;
  return name && name.length > 0 ? name : undefined;
}

export function repairEmptyToolNames(toolName: string) {
  return createMiddleware({
    name: "RepairEmptyToolNames",
    wrapModelCall: async (request, handler) => {
      const response = await handler(request);
      if (!AIMessage.isInstance(response)) return response;
      const calls = response.tool_calls ?? [];
      if (calls.length === 0) return response;
      let changed = false;
      const tool_calls = calls.map((call, index) => {
        if (call.name) return call;
        changed = true;
        const name = rawToolName(response, index) ?? toolName;
        return { ...call, name };
      });
      if (!changed) return response;
      const names = tool_calls.map((call: ToolCall) => call.name).join(",");
      console.log(`[repair] empty tool name -> ${names}`);
      return new AIMessage({
        content: response.content,
        tool_calls,
        invalid_tool_calls: response.invalid_tool_calls,
        additional_kwargs: response.additional_kwargs,
        response_metadata: response.response_metadata,
        usage_metadata: response.usage_metadata,
        id: response.id,
        name: response.name,
      });
    },
  });
}
