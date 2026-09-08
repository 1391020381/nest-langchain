import { describe, expect, test } from "bun:test";
import { listSkills } from "deepagents";
import { join } from "node:path";
import { loadRequirementSkillFiles } from "../src/agent/skill-files";

describe("packaged requirement-analysis skill", () => {
  test("DeepAgent's disk loader accepts the SKILL.md metadata", () => {
    const skills = listSkills({
      projectSkillsDir: join(import.meta.dir, "..", "skills"),
    });

    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: "requirement-analysis",
      source: "project",
    });
    expect(skills[0].description.length).toBeGreaterThan(20);
  });

  test("all skill resources are copied to POSIX StateBackend paths", async () => {
    const files = await loadRequirementSkillFiles();

    expect(Object.keys(files).sort()).toEqual([
      "/skills/requirement-analysis/SKILL.md",
      "/skills/requirement-analysis/assets/report-template.md",
      "/skills/requirement-analysis/references/scoring-rubric.md",
    ]);
    for (const [path, file] of Object.entries(files)) {
      expect(path).not.toContain("\\");
      expect(file.mimeType).toBe("text/markdown");
      expect(typeof file.content).toBe("string");
      expect(String(file.content).length).toBeGreaterThan(20);
      expect(Number.isNaN(Date.parse(file.created_at))).toBe(false);
      expect(file.modified_at).toBe(file.created_at);
    }
    expect(String(files["/skills/requirement-analysis/SKILL.md"].content)).toContain(
      "references/scoring-rubric.md",
    );
    expect(
      String(
        files[
          "/skills/requirement-analysis/assets/report-template.md"
        ].content,
      ),
    ).toContain("验收标准");
  });
});
