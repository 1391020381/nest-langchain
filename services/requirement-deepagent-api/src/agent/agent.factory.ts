import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createDeepAgent } from "deepagents";
import {
  REQUIREMENT_COORDINATOR_NAME,
  REQUIREMENT_COORDINATOR_PROMPT,
} from "./root/coordinator.prompt";
import { createRequirementAnalystSubagent } from "./subagents/requirement-analyst";

export function createRequirementDeepAgent(model: BaseChatModel) {
  return createDeepAgent({
    name: REQUIREMENT_COORDINATOR_NAME,
    model,
    tools: [],
    systemPrompt: REQUIREMENT_COORDINATOR_PROMPT,
    subagents: [createRequirementAnalystSubagent()],
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
