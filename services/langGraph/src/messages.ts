import type { BaseMessage } from "@langchain/core/messages";

export function messageContentToString(content: BaseMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if ("text" in part && typeof part.text === "string") return part.text;
      return JSON.stringify(part);
    })
    .join("");
}

export function getLastAIText(messages: BaseMessage[]): string {
  const lastAI = [...messages]
    .reverse()
    .find((message) => message._getType() === "ai");
  return lastAI ? messageContentToString(lastAI.content) : "";
}
