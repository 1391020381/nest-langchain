import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { FilesystemPermission, SubAgent } from "deepagents";
import type { ReturnTypeOfRequirementTools } from "../types";
import { createHistoryToolCallLimitMiddleware } from "../workflow-limits.middleware";

export const REQUIREMENT_SUBAGENT_NAMES = [
  "requirement-analyst",
  "risk-reviewer",
  "acceptance-designer",
] as const;

export const REQUIREMENT_SUBAGENT_ARTIFACTS = {
  "requirement-analyst": "/work/requirement-analysis.md",
  "risk-reviewer": "/work/risk-review.md",
  "acceptance-designer": "/work/acceptance-criteria.md",
} as const satisfies Record<
  (typeof REQUIREMENT_SUBAGENT_NAMES)[number],
  string
>;

function artifactPermissions(artifactPath: string): FilesystemPermission[] {
  return [
    { operations: ["read"], paths: ["/"] },
    { operations: ["read"], paths: ["/skills/**", "/work/**"] },
    { operations: ["write"], paths: [artifactPath] },
    { operations: ["read", "write"], paths: ["/**"], mode: "deny" },
  ];
}

function finiteExpertMiddleware() {
  return [
    // 当前三个专家按设计只需要约 1-4 次工具调用。若模型仍在探索或
    // 回读，第 9 次调用会直接结束该专家，让协调器使用已经写入的产物。
    createHistoryToolCallLimitMiddleware({
      limit: 8,
      exitBehavior: "end",
    }),
    createHistoryToolCallLimitMiddleware({
      toolName: "write_file",
      limit: 1,
      exitBehavior: "continue",
    }),
  ];
}

export function createRequirementSubagents(
  model: BaseChatModel,
  tools: ReturnTypeOfRequirementTools,
): SubAgent[] {
  return [
    {
      name: REQUIREMENT_SUBAGENT_NAMES[0],
      description:
        "检查需求完整性、识别待澄清项、拆解功能边界并估算复杂度。",
      model,
      middleware: finiteExpertMiddleware(),
      tools: [tools.analyzeCompletenessTool, tools.estimateComplexityTool],
      skills: ["/skills/"],
      permissions: artifactPermissions(
        REQUIREMENT_SUBAGENT_ARTIFACTS["requirement-analyst"],
      ),
      systemPrompt:
        "你是资深产品需求分析师。一次性完成本任务：读取 requirement-analysis Skill 一次，再分别调用 analyze_completeness 和 estimate_complexity 一次。禁止调用 write_todos、task、ls、glob、grep，禁止重复读取同一文件。生成完整 Markdown 事实清单后，必须且只能调用一次 write_file 写入 /work/requirement-analysis.md。write_file 成功后不要回读文件、不要继续检查，立即用一句话回复完成并结束。禁止使用根目录、相对路径或自定义文件名。",
    },
    {
      name: REQUIREMENT_SUBAGENT_NAMES[1],
      description:
        "独立审查技术、数据、安全、进度、外部依赖和需求歧义风险。",
      model,
      middleware: finiteExpertMiddleware(),
      permissions: artifactPermissions(
        REQUIREMENT_SUBAGENT_ARTIFACTS["risk-reviewer"],
      ),
      systemPrompt:
        "你是独立风险审查专家。仅依据任务中给出的用户需求，一次性逐项给出风险等级、触发条件、影响、证据充分度和缓解方案；证据不足必须说明。无需探索虚拟文件系统，禁止调用 write_todos、task、ls、glob、grep、read_file。生成完整 Markdown 后，必须且只能调用一次 write_file 写入 /work/risk-review.md。write_file 成功后不要回读文件、不要继续检查，立即用一句话回复完成并结束。禁止使用根目录、相对路径或自定义文件名。",
    },
    {
      name: REQUIREMENT_SUBAGENT_NAMES[2],
      description:
        "把需求转化为可执行的 Given-When-Then 验收标准与边界测试。",
      model,
      middleware: finiteExpertMiddleware(),
      skills: ["/skills/"],
      permissions: artifactPermissions(
        REQUIREMENT_SUBAGENT_ARTIFACTS["acceptance-designer"],
      ),
      systemPrompt:
        "你是 QA 与验收设计专家。一次性完成本任务：读取 requirement-analysis Skill 一次，覆盖正常路径、失败路径、权限、数据边界和非功能场景，全部使用 Given-When-Then。禁止调用 write_todos、task、ls、glob、grep，禁止重复读取同一文件。生成完整 Markdown 后，必须且只能调用一次 write_file 写入 /work/acceptance-criteria.md。write_file 成功后不要回读文件、不要继续检查，立即用一句话回复完成并结束。禁止使用根目录、相对路径或自定义文件名。",
    },
  ];
}
