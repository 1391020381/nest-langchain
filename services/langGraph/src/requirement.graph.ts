import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  END,
  START,
  StateGraph,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
import { createRequirementNodes, type RequirementNodes } from "./nodes.js";
import {
  RequirementState,
  type ExpertName,
  type RequirementGraphState,
} from "./state.js";

export type RequirementGraphOptions = {
  checkpointer?: BaseCheckpointSaver;
  interruptBefore?: string[];
};

export function routeByIntent(state: RequirementGraphState) {
  if (state.intent === "chat") return "chatHandler";
  if (state.intent === "query") return "queryHandler";
  return "supervisor";
}

const EXPERT_NODE_MAP: Record<ExpertName, keyof RequirementNodes> = {
  functional: "functionalExpert",
  performance: "performanceExpert",
  security: "securityExpert",
  compliance: "complianceExpert",
};

export function routeToExperts(state: RequirementGraphState) {
  return state.activeExperts.map((expert) => EXPERT_NODE_MAP[expert]);
}

export function routeAfterCritic(state: RequirementGraphState) {
  if (!state.critique.trim()) return "done";
  if (state.reviseCount >= 2) return "done";
  return "refine";
}

/**
 * 图拓扑和节点实现分离，测试可以注入确定性节点，不需要真实 API Key。
 */
export function buildRequirementGraph(
  nodes: RequirementNodes,
  options: RequirementGraphOptions = {},
) {
  return new StateGraph(RequirementState)
    .addNode("triage", nodes.triage)
    .addNode("chatHandler", nodes.chatHandler)
    .addNode("queryHandler", nodes.queryHandler)
    .addNode("supervisor", nodes.supervisor)
    .addNode("functionalExpert", nodes.functionalExpert)
    .addNode("performanceExpert", nodes.performanceExpert)
    .addNode("securityExpert", nodes.securityExpert)
    .addNode("complianceExpert", nodes.complianceExpert)
    .addNode("aggregator", nodes.aggregator)
    .addNode("actor", nodes.actor)
    .addNode("critic", nodes.critic)
    .addNode("refine", nodes.refine)
    .addEdge(START, "triage")
    .addConditionalEdges("triage", routeByIntent, {
      chatHandler: "chatHandler",
      queryHandler: "queryHandler",
      supervisor: "supervisor",
    })
    .addEdge("chatHandler", END)
    .addEdge("queryHandler", END)
    .addConditionalEdges("supervisor", routeToExperts, {
      functionalExpert: "functionalExpert",
      performanceExpert: "performanceExpert",
      securityExpert: "securityExpert",
      complianceExpert: "complianceExpert",
    })
    .addEdge("functionalExpert", "aggregator")
    .addEdge("performanceExpert", "aggregator")
    .addEdge("securityExpert", "aggregator")
    .addEdge("complianceExpert", "aggregator")
    .addEdge("aggregator", "actor")
    .addEdge("actor", "critic")
    .addConditionalEdges("critic", routeAfterCritic, {
      refine: "refine",
      done: END,
    })
    .addEdge("refine", "critic")
    .compile({
      checkpointer: options.checkpointer,
      interruptBefore: options.interruptBefore as never,
    });
}

export function createRequirementGraph(
  model: BaseChatModel,
  options: RequirementGraphOptions = {},
) {
  return buildRequirementGraph(createRequirementNodes(model), options);
}
