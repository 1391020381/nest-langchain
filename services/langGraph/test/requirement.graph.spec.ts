import { describe, expect, test } from "bun:test";
import { MemorySaver } from "@langchain/langgraph";
import type { RequirementNodes } from "../src/nodes.js";
import { buildRequirementGraph } from "../src/requirement.graph.js";

function createDeterministicNodes(
  overrides: Partial<RequirementNodes> = {},
): RequirementNodes {
  const nodes: RequirementNodes = {
    triage: (state) => {
      if (state.input.startsWith("闲聊")) {
        return { intent: "chat", directAnswer: "你好，这是短路回答" };
      }
      if (state.input.startsWith("查询")) return { intent: "query" };
      return { intent: "analyze" };
    },
    chatHandler: (state) => ({ summary: state.directAnswer }),
    queryHandler: () => ({ summary: "REQ-001 状态：reviewing" }),
    supervisor: (state) => ({
      activeExperts: state.input.includes("敏感")
        ? ["functional", "security"]
        : ["functional"],
    }),
    functionalExpert: () => ({ functionalAnalysis: "功能分析完成" }),
    performanceExpert: () => ({ performanceAnalysis: "性能分析完成" }),
    securityExpert: () => ({ securityAnalysis: "安全分析完成" }),
    complianceExpert: () => ({ complianceAnalysis: "合规分析完成" }),
    aggregator: (state) => ({
      analysisResult: [
        state.functionalAnalysis,
        state.performanceAnalysis,
        state.securityAnalysis,
        state.complianceAnalysis,
      ]
        .filter(Boolean)
        .join(" + "),
    }),
    actor: (state) => ({
      summary: `初版：${state.analysisResult}`,
      critique: "",
      reviseCount: 0,
    }),
    critic: () => ({ critique: "" }),
    refine: (state) => ({
      summary: `${state.summary}（已修订）`,
      reviseCount: state.reviseCount + 1,
    }),
  };
  return { ...nodes, ...overrides };
}

describe("LangGraph 学习主图", () => {
  test("chat 和 query 走短路，不进入专家链路", async () => {
    let expertCalls = 0;
    const nodes = createDeterministicNodes({
      functionalExpert: () => {
        expertCalls += 1;
        return { functionalAnalysis: "不应执行" };
      },
    });
    const graph = buildRequirementGraph(nodes);

    const chat = await graph.invoke({ input: "闲聊：你好" });
    const query = await graph.invoke({ input: "查询 REQ-001 状态" });

    expect(chat.summary).toBe("你好，这是短路回答");
    expect(query.summary).toContain("reviewing");
    expect(expertCalls).toBe(0);
  });

  test("Supervisor 返回数组后并发专家写独立字段并在 aggregator 汇合", async () => {
    const startTimes: number[] = [];
    const nodes = createDeterministicNodes({
      functionalExpert: async () => {
        startTimes.push(Date.now());
        await Bun.sleep(30);
        return { functionalAnalysis: "功能分析完成" };
      },
      securityExpert: async () => {
        startTimes.push(Date.now());
        await Bun.sleep(30);
        return { securityAnalysis: "安全分析完成" };
      },
    });
    const result = await buildRequirementGraph(nodes).invoke({
      input: "分析敏感数据导出",
    });

    expect(result.activeExperts).toEqual(["functional", "security"]);
    expect(result.analysisResult).toContain("功能分析完成");
    expect(result.analysisResult).toContain("安全分析完成");
    expect(startTimes).toHaveLength(2);
    expect(Math.abs(startTimes[0] - startTimes[1])).toBeLessThan(20);
  });

  test("Critic 不通过时进入 refine，并在再次通过后收敛", async () => {
    let criticCalls = 0;
    const nodes = createDeterministicNodes({
      critic: (state) => {
        criticCalls += 1;
        return {
          critique: state.reviseCount === 0 ? "缺少验收标准" : "",
        };
      },
    });
    const result = await buildRequirementGraph(nodes).invoke({
      input: "分析普通功能需求",
    });

    expect(result.reviseCount).toBe(1);
    expect(result.summary).toContain("已修订");
    expect(criticCalls).toBe(2);
  });

  test("updates 流只包含实际执行路径上的节点", async () => {
    const graph = buildRequirementGraph(createDeterministicNodes());
    const stream = await graph.stream(
      { input: "闲聊：你好" },
      { streamMode: "updates" },
    );
    const nodeNames: string[] = [];
    for await (const update of stream) {
      nodeNames.push(...Object.keys(update));
    }

    expect(nodeNames).toContain("triage");
    expect(nodeNames).toContain("chatHandler");
    expect(nodeNames).not.toContain("supervisor");
    expect(nodeNames).not.toContain("functionalExpert");
  });

  test("Checkpointer 在 actor 前暂停，updateState 后可以从断点恢复", async () => {
    const checkpointer = new MemorySaver();
    const graph = buildRequirementGraph(createDeterministicNodes(), {
      checkpointer,
      interruptBefore: ["actor"],
    });
    const config = {
      configurable: { thread_id: "hitl-test-thread" },
    };

    await graph.invoke({ input: "分析普通功能需求" }, config);
    const snapshot = await graph.getState(config);
    expect(snapshot.next).toContain("actor");
    expect(snapshot.values.analysisResult).toContain("功能分析完成");

    await graph.updateState(config, {
      analysisResult: `${snapshot.values.analysisResult} + 人工补充`,
    });
    const result = await graph.invoke(null, config);
    expect(result.summary).toContain("人工补充");
  });
});
