import type { BaseMessage } from "@langchain/core/messages";

import { inspectMessage } from "../ch01-langchain-foundations/message-inspector";

export type HarnessTodo = {
  content: string;
  status: "pending" | "in_progress" | "completed";
};

export type HarnessSnapshot = {
  messages: BaseMessage[];
  todos: HarnessTodo[];
  files: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readTodos(value: unknown): HarnessTodo[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const todo = asRecord(item);
    if (
      typeof todo.content !== "string" ||
      !["pending", "in_progress", "completed"].includes(
        String(todo.status),
      )
    ) {
      return [];
    }
    return [todo as HarnessTodo];
  });
}

function readMessages(value: unknown): BaseMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (message): message is BaseMessage =>
      Boolean(
        message &&
          typeof message === "object" &&
          "getType" in message &&
          typeof message.getType === "function",
      ),
  );
}

function compact(value: unknown, maxLength = 500): string {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length <= maxLength
    ? text
    : `${text.slice(0, maxLength)}…（已截断）`;
}

export function readFileText(
  files: Record<string, unknown>,
  path: string,
): string | undefined {
  const file = asRecord(files[path]);
  const content = file.content;
  if (typeof content === "string") return content.trim() || undefined;
  if (Array.isArray(content) && content.every((line) => typeof line === "string")) {
    return content.join("\n").trim() || undefined;
  }
  return undefined;
}

/**
 * 观察 streamMode=values 返回的完整 State，并只打印本轮新增或变化的部分。
 */
export function createHarnessObserver(
  log: (text: string) => void = console.log,
) {
  let messageCount = 0;
  let previousTodos = "[]";
  let previousFiles = "{}";
  let latest: HarnessSnapshot = { messages: [], todos: [], files: {} };

  return {
    observe(state: unknown): HarnessSnapshot {
      const record = asRecord(state);
      const messages = readMessages(record.messages);
      const todos = readTodos(record.todos);
      const files = asRecord(record.files);

      for (let index = messageCount; index < messages.length; index += 1) {
        const inspected = inspectMessage(messages[index]);
        log(`\n[Message ${index}] ${inspected.type} · 产生者：${inspected.producer}`);
        if (inspected.toolCalls.length > 0) {
          log(`tool_calls: ${compact(inspected.toolCalls)}`);
        }
        if (inspected.toolCallId) {
          log(`tool_call_id: ${inspected.toolCallId}`);
        }
        if (inspected.content !== "" && inspected.content !== undefined) {
          log(`content: ${compact(inspected.content)}`);
        }
      }
      messageCount = Math.max(messageCount, messages.length);

      const todoSignature = JSON.stringify(todos);
      if (todoSignature !== previousTodos) {
        log(
          `\n[Todos]\n${todos
            .map((todo, index) =>
              `${index + 1}. [${todo.status}] ${todo.content}`,
            )
            .join("\n") || "（空）"}`,
        );
        previousTodos = todoSignature;
      }

      const fileSignature = JSON.stringify(files);
      if (fileSignature !== previousFiles) {
        log(`\n[Files] ${Object.keys(files).sort().join(", ") || "（空）"}`);
        previousFiles = fileSignature;
      }

      latest = { messages, todos, files };
      return latest;
    },
    snapshot(): HarnessSnapshot {
      return latest;
    },
  };
}

