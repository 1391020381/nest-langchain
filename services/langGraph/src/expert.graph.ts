import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { END, START, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ExpertState } from "./state.js";

export type ExpertGraphOptions = {
  name: string;
  model: BaseChatModel;
  tools: StructuredToolInterface[];
  systemPrompt: string;
  maxToolRounds?: number;
};

/** 通用 ReAct 子图：agent -> tools -> agent，直到没有 tool_calls。 */
export function createExpertGraph(options: ExpertGraphOptions) {
  const {
    name,
    model,
    tools,
    systemPrompt,
    maxToolRounds = 4,
  } = options;
  const toolNode = new ToolNode(tools);

  async function agentNode(state: typeof ExpertState.State) {
    const runnable =
      state.toolRounds >= maxToolRounds
        ? model
        : model.bindTools?.(tools);
    if (!runnable) {
      throw new Error(`${name} 使用的模型不支持 bindTools()`);
    }
    const response = await runnable.invoke([
      new SystemMessage(`${systemPrompt}

工具规则：
1. 只在缺少信息时调用工具；
2. 不要用相同参数重复调用同一工具；
3. 信息足够后直接输出最终 Markdown 报告；
4. 最多调用工具 ${maxToolRounds} 轮。`),
      ...state.messages,
    ]);
    return { messages: [response] };
  }

  async function toolsNode(state: typeof ExpertState.State) {
    const result = await toolNode.invoke(state);
    return {
      messages: result.messages ?? [],
      toolRounds: state.toolRounds + 1,
    };
  }

  function routeAfterAgent(state: typeof ExpertState.State) {
    const last = state.messages.at(-1);
    const toolCalls = last && "tool_calls" in last ? last.tool_calls : undefined;
    return Array.isArray(toolCalls) && toolCalls.length > 0 ? "tools" : "done";
  }

  return new StateGraph(ExpertState)
    .addNode("agent", agentNode)
    .addNode("tools", toolsNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", routeAfterAgent, {
      tools: "tools",
      done: END,
    })
    .addEdge("tools", "agent")
    .compile({ name: `${name}_react_graph` });
}

export async function runExpertGraph(
  graph: ReturnType<typeof createExpertGraph>,
  input: string,
) {
  return graph.invoke({ messages: [new HumanMessage(input)], toolRounds: 0 });
}
