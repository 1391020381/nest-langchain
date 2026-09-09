import { describe, expect, it } from "bun:test";
import {
  exportTodos,
  exportWorkArtifacts,
  finalReportFromArtifacts,
} from "../src/agent/runtime/state-exporter";

describe("StateBackend workspace exporter", () => {
  it("exports only virtual /work files from both supported FileData formats", () => {
    const artifacts = exportWorkArtifacts({
      files: {
        "/work/final-report.md": { content: ["# 报告", "完成"] },
        "/work/notes.txt": { content: "备注" },
        "/private/ignored.md": { content: ["不要导出"] },
      },
    });

    expect(artifacts.map((artifact) => artifact.path)).toEqual([
      "/work/final-report.md",
      "/work/notes.txt",
    ]);
    expect(artifacts.every((artifact) => artifact.virtual)).toBe(true);
    expect(finalReportFromArtifacts(artifacts)).toBe("# 报告\n完成");
  });

  it("normalizes valid todos and ignores malformed values", () => {
    expect(
      exportTodos({
        todos: [
          { content: "分析", status: "completed" },
          { content: "无效", status: "unknown" },
        ],
      }),
    ).toEqual([{ content: "分析", status: "completed" }]);
  });
});
