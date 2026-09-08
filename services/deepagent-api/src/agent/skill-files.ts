import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FileData } from "deepagents";

const SKILL_FILES = [
  "SKILL.md",
  "references/scoring-rubric.md",
  "assets/report-template.md",
] as const;

/**
 * StateBackend 只认识虚拟文件，因此启动每次运行时，把仓库内受版本控制的
 * Skill 复制进该次运行的 `/skills` 状态。这里没有把整个宿主机目录暴露给模型。
 */
export async function loadRequirementSkillFiles(): Promise<
  Record<string, FileData>
> {
  const skillRoot = join(
    __dirname,
    "..",
    "..",
    "skills",
    "requirement-analysis",
  );
  const timestamp = new Date().toISOString();
  const entries = await Promise.all(
    SKILL_FILES.map(async (relativePath) => {
      const content = await readFile(join(skillRoot, relativePath), "utf8");
      const virtualPath = `/skills/requirement-analysis/${relativePath.replaceAll("\\", "/")}`;
      const file: FileData = {
        content,
        mimeType: "text/markdown",
        created_at: timestamp,
        modified_at: timestamp,
      };
      return [virtualPath, file] as const;
    }),
  );

  return Object.fromEntries(entries);
}
