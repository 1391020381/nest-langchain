import type { StreamMessage } from "./ui-types";

export function formatSse(message: StreamMessage): string {
  return `data: ${JSON.stringify(message)}\n\n`;
}
