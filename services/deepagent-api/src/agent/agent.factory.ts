import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  createDeepAgent,
  registerHarnessProfile,
  StateBackend,
} from "deepagents";
import { COORDINATOR_PROMPT } from "./prompts/coordinator.prompt";
import { createRequirementSubagents } from "./subagents/requirement.subagents";
import { createRequirementTools } from "./tools/requirement.tools";
import { createHistoryToolCallLimitMiddleware } from "./workflow-limits.middleware";

// 本项目只暴露三个职责明确的专家，关闭 OpenAI profile 自动添加的
// general-purpose 子代理，避免绕过最小工具/权限边界。
registerHarnessProfile("openai", {
  generalPurposeSubagent: { enabled: false },
});

export function createRequirementAgent(model: BaseChatModel) {
  const tools = createRequirementTools();
  const subagents = createRequirementSubagents(model, tools);

  return createDeepAgent({
    name: "requirement-coordinator",
    model,
    tools: tools.all,
    subagents,
    systemPrompt: COORDINATOR_PROMPT,
    middleware: [
      // 第二轮 task 会在真正启动子代理前被拒绝，协调器仍可继续汇总
      // 第一轮已经生成的产物。这样既保留自治，又避免重复委派失控。
      createHistoryToolCallLimitMiddleware({
        toolName: "task",
        limit: 3,
        exitBehavior: "continue",
      }),
    ],
    backend: new StateBackend(),
    skills: ["/skills/"],
    permissions: [
      // 允许 Agent 列出 VFS 根目录来发现 /skills 与 /work；精确路径
      // "/" 不会放开任何子目录内容，后续规则仍负责实际读写边界。
      { operations: ["read"], paths: ["/"] },
      { operations: ["read"], paths: ["/skills/**"] },
      { operations: ["read", "write"], paths: ["/work/**"] },
      { operations: ["read", "write"], paths: ["/**"], mode: "deny" },
    ],
  });
}
