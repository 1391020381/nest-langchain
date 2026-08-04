import type { UIAction, AIUIResponse } from "./ui-types";

export function formatActionContent(action: UIAction): string {
  return `[UI 操作: ${action.componentType} → ${action.payload.type}]`;
}

export function extractCollectedData(
  messages: Array<{ role: string; metadata: unknown }>,
): Record<string, unknown> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (row.role !== "ai") continue;
    const meta = row.metadata as
      | { ui?: AIUIResponse }
      | null
      | undefined;
    const collected = meta?.ui?.context?.collectedData;
    if (collected && typeof collected === "object") {
      return { ...collected };
    }
  }
  return {};
}

export function mergeCollectedData(
  base: Record<string, unknown>,
  action: UIAction,
): Record<string, unknown> {
  const next = { ...base };
  const p = action.payload;
  if (p.type === "select") {
    next.lastSelectedId = p.selectedId;
    if (typeof p.selectedId === "string" && !next.reqType) {
      next.reqType = p.selectedId;
    }
  } else if (p.type === "submit") {
    Object.assign(next, p.formData);
  } else if (p.type === "confirm") {
    next.lastConfirmed = p.confirmed;
  } else if (p.type === "click") {
    next.lastActionId = p.actionId;
  } else if (p.type === "row_select") {
    next.lastRowIndex = p.rowIndex;
  }
  return next;
}
