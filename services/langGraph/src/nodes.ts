import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod";
import { createExpertGraph, runExpertGraph } from "./expert.graph.js";
import { getLastAIText, messageContentToString } from "./messages.js";
import type {
  ExpertName,
  RequirementGraphState,
  RequirementGraphUpdate,
} from "./state.js";
import {
  checkComplianceTool,
  checkConflictsTool,
  checkSecurityPolicyTool,
  loadPerformanceBaselineTool,
  searchRequirementTool,
} from "./tools.js";

export type RequirementNode = (
  state: RequirementGraphState,
) => RequirementGraphUpdate | Promise<RequirementGraphUpdate>;

export type RequirementNodes = {
  triage: RequirementNode;
  chatHandler: RequirementNode;
  queryHandler: RequirementNode;
  supervisor: RequirementNode;
  functionalExpert: RequirementNode;
  performanceExpert: RequirementNode;
  securityExpert: RequirementNode;
  complianceExpert: RequirementNode;
  aggregator: RequirementNode;
  actor: RequirementNode;
  critic: RequirementNode;
  refine: RequirementNode;
};

const triageSchema = z.object({
  intent: z.enum(["chat", "query", "analyze"]),
  answer: z.string().describe("仅 chat 时直接回答，否则为空字符串"),
  reason: z.string(),
});

const supervisorSchema = z.object({
  experts: z.array(z.enum([
    "functional",
    "performance",
    "security",
    "compliance",
  ])).min(1).max(4),
  reason: z.string(),
});

const criticSchema = z.object({
  pass: z.boolean(),
  critique: z.string(),
});

type ExpertOutputField =
  | "functionalAnalysis"
  | "performanceAnalysis"
  | "securityAnalysis"
  | "complianceAnalysis";

function createExpertNode(options: {
  expert: ExpertName;
  outputField: ExpertOutputField;
  graph: ReturnType<typeof createExpertGraph>;
}): RequirementNode {
  return async (state) => {
    try {
      const result = await runExpertGraph(options.graph, state.input);
      const content = getLastAIText(result.messages);
      return {
        [options.outputField]:
          content || `[${options.expert} 专家未生成有效输出]`,
      } as RequirementGraphUpdate;
    } catch (error) {
      return {
        [options.outputField]:
          `[${options.expert} 专家暂不可用：${String(error)}]，建议人工补充。`,
      } as RequirementGraphUpdate;
    }
  };
}

export function createRequirementNodes(model: BaseChatModel): RequirementNodes {
  const functionalGraph = createExpertGraph({
    name: "functional",
    model,
    tools: [searchRequirementTool, checkConflictsTool],
    systemPrompt: `你是功能需求分析专家。输出必须包含：
## 功能拆解
## 用户流程
## 功能依赖
## 冲突分析
## 实施建议`,
  });
  const performanceGraph = createExpertGraph({
    name: "performance",
    model,
    tools: [searchRequirementTool, loadPerformanceBaselineTool],
    systemPrompt: `你是性能分析专家。输出必须包含：
## 负载特征
## 性能基线
## 瓶颈分析
## 容量与优化建议`,
  });
  const securityGraph = createExpertGraph({
    name: "security",
    model,
    tools: [searchRequirementTool, checkSecurityPolicyTool],
    systemPrompt: `你是信息安全专家。输出必须包含：
## 威胁识别
## 认证与授权
## 数据保护
## 审计要求
## 安全实施建议`,
  });
  const complianceGraph = createExpertGraph({
    name: "compliance",
    model,
    tools: [searchRequirementTool, checkComplianceTool],
    systemPrompt: `你是数据合规专家。输出必须包含：
## 法规适用性
## 数据生命周期
## 数据地域与跨境
## 合规风险
## 整改建议`,
  });

  return {
    triage: async (state) => {
      try {
        const structured = model.withStructuredOutput(triageSchema);
        const result = await structured.invoke([
          new SystemMessage(`你是需求分诊 Agent：
- chat：问候、感谢、闲聊、概念解释；
- query：查询已有 REQ 编号的状态或详情；
- analyze：要求分析、评估、检查风险或设计方案。
无法判断时默认 analyze。chat 时直接填写 answer。`),
          new HumanMessage(state.input),
        ]);
        return { intent: result.intent, directAnswer: result.answer };
      } catch {
        if (/查询|状态|进度/.test(state.input)) return { intent: "query" };
        if (/你好|谢谢|再见/.test(state.input)) {
          return { intent: "chat", directAnswer: "你好，有什么可以帮你？" };
        }
        return { intent: "analyze" };
      }
    },

    chatHandler: (state) => ({
      summary: state.directAnswer || "你好，有什么可以帮你？",
    }),

    queryHandler: async (state) => {
      const response = await model.invoke([
        new SystemMessage("你是需求查询助手，只回答需求状态和已有信息。"),
        new HumanMessage(state.input),
      ]);
      return { summary: messageContentToString(response.content) };
    },

    supervisor: async (state) => {
      const structured = model.withStructuredOutput(supervisorSchema);
      const result = await structured.invoke([
        new SystemMessage(`你是需求分析调度员：
- 所有需求至少选择 functional；
- 批量、大文件、高并发、实时性选择 performance；
- 登录、权限、敏感数据、上传下载选择 security；
- 个人信息、跨境、金融、医疗、监管选择 compliance。
只选择实际需要的专家。`),
        new HumanMessage(state.input),
      ]);
      return { activeExperts: result.experts };
    },

    functionalExpert: createExpertNode({
      expert: "functional",
      outputField: "functionalAnalysis",
      graph: functionalGraph,
    }),
    performanceExpert: createExpertNode({
      expert: "performance",
      outputField: "performanceAnalysis",
      graph: performanceGraph,
    }),
    securityExpert: createExpertNode({
      expert: "security",
      outputField: "securityAnalysis",
      graph: securityGraph,
    }),
    complianceExpert: createExpertNode({
      expert: "compliance",
      outputField: "complianceAnalysis",
      graph: complianceGraph,
    }),

    aggregator: (state) => {
      const fields: Record<ExpertName, [string, string]> = {
        functional: ["功能分析", state.functionalAnalysis],
        performance: ["性能分析", state.performanceAnalysis],
        security: ["安全分析", state.securityAnalysis],
        compliance: ["合规分析", state.complianceAnalysis],
      };
      const parts = state.activeExperts.flatMap((expert) => {
        const [title, content] = fields[expert];
        return content ? [`# ${title}\n\n${content}`] : [];
      });
      return { analysisResult: parts.join("\n\n---\n\n") };
    },

    actor: async (state) => {
      const response = await model.invoke([
        new SystemMessage(`你是资深需求分析师。综合专家意见生成统一报告，必须包含：
## 需求摘要
## 核心分析
## 风险与冲突
## 实施建议
## 验收标准`),
        new HumanMessage(
          `原始需求：\n${state.input}\n\n专家分析：\n${state.analysisResult}`,
        ),
      ]);
      return {
        summary: messageContentToString(response.content),
        critique: "",
        reviseCount: 0,
      };
    },

    critic: async (state) => {
      const structured = model.withStructuredOutput(criticSchema);
      const result = await structured.invoke([
        new SystemMessage(`按客观标准评审报告：
1. 有需求摘要；2. 有风险或冲突；3. 有实施建议；4. 有验收标准；5. 无明显矛盾。
全部满足则 pass=true、critique=""；否则只给最关键的 1-2 条修改意见。`),
        new HumanMessage(state.summary),
      ]);
      return { critique: result.pass ? "" : result.critique };
    },

    refine: async (state) => {
      const response = await model.invoke([
        new SystemMessage("只修订评审指出的问题，保留其他正确章节。"),
        new HumanMessage(
          `原报告：\n${state.summary}\n\n评审意见：\n${state.critique}`,
        ),
      ]);
      return {
        summary: messageContentToString(response.content),
        reviseCount: state.reviseCount + 1,
      };
    },
  };
}
