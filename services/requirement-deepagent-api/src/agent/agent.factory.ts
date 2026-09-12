import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { MemorySaver } from "@langchain/langgraph";
import { createDeepAgent } from "deepagents";
import { requestRequirementClarificationTool } from "./clarification.tool";
import {
  REQUIREMENT_COORDINATOR_NAME,
  REQUIREMENT_COORDINATOR_PROMPT,
} from "./root/coordinator.prompt";
import { createRequirementAnalystSubagent } from "./subagents/requirement-analyst";

export function createRequirementDeepAgent(model: BaseChatModel) {
  return createDeepAgent({
    name: REQUIREMENT_COORDINATOR_NAME,
    model,
    tools: [requestRequirementClarificationTool],
    systemPrompt: REQUIREMENT_COORDINATOR_PROMPT,
    subagents: [createRequirementAnalystSubagent()],
    checkpointer: new MemorySaver(),
    permissions: [
      {
        operations: ["read", "write"],
        paths: ["/work/**"],
        mode: "allow",
      },
      {
        operations: ["read", "write"],
        paths: ["/**"],
        mode: "deny",
      },
    ],
  });
}
