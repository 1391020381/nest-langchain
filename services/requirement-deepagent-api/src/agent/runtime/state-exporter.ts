import type {
  RequirementArtifact,
  RequirementTodo,
} from "@autix/requirement-deepagent-contracts";
import { FINAL_REPORT_PATH } from "../root/coordinator.prompt";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object"
    ? (value as UnknownRecord)
    : undefined;
}

function textFromFileData(value: unknown): string | undefined {
  const file = asRecord(value);
  const content = file?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content) && content.every((line) => typeof line === "string")) {
    return content.join("\n");
  }
  if (content instanceof Uint8Array) {
    return new TextDecoder().decode(content);
  }
  return undefined;
}

function mediaTypeFor(path: string): RequirementArtifact["mediaType"] {
  return path.toLowerCase().endsWith(".md") ? "text/markdown" : "text/plain";
}

export function exportWorkArtifacts(state: unknown): RequirementArtifact[] {
  const files = asRecord(asRecord(state)?.files);
  if (!files) return [];

  return Object.entries(files)
    .filter(([path]) => path === "/work" || path.startsWith("/work/"))
    .flatMap(([path, value]) => {
      const content = textFromFileData(value);
      return content === undefined
        ? []
        : [
            {
              path,
              mediaType: mediaTypeFor(path),
              content,
              sizeChars: content.length,
              virtual: true as const,
            },
          ];
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function exportTodos(state: unknown): RequirementTodo[] {
  const todos = asRecord(state)?.todos;
  if (!Array.isArray(todos)) return [];

  return todos.flatMap((value) => {
    const todo = asRecord(value);
    const content = todo?.content;
    const status = todo?.status;
    if (
      typeof content !== "string" ||
      (status !== "pending" &&
        status !== "in_progress" &&
        status !== "completed")
    ) {
      return [];
    }
    return [{ content, status }];
  });
}

export function finalReportFromArtifacts(
  artifacts: RequirementArtifact[],
): string | undefined {
  return artifacts.find((artifact) => artifact.path === FINAL_REPORT_PATH)?.content;
}
