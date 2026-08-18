/**
 * DeepAgent 产品调研 Demo — 第十四章 14.5 / 14.9
 *
 * 概念：
 * - write_todos：复杂任务先规划再执行
 * - 虚拟文件系统：中间产物可写文件，不堆在 messages 里
 * - skills：必须配 FilesystemBackend，否则读不到磁盘上的 SKILL.md
 * - allowed-tools 只是声明，Python 工具仍要显式注册
 *
 * 运行：cd services/chat && bun run scripts/run-deepagent-research-demo.ts
 */
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { join } from "path";
import { config } from "dotenv";
import { callPythonTool, SKILLS_DIR } from "../src/skills/call-python-tool";

config({ path: join(import.meta.dir, "../.env") });

if (!process.env.OPENAI_API_KEY) {
  throw new Error("缺少 OPENAI_API_KEY。请先配置 services/chat/.env，或只跑 Layer 1：bun test test/chapter14-deepagent.spec.ts");
}

const tools = [
  new DynamicStructuredTool({
    name: "search_competitors",
    description: "搜索竞品信息，返回竞品名称、定位、定价等关键信息。",
    schema: z.object({ query: z.string().describe("搜索关键词") }),
    func: async ({ query }) =>
      callPythonTool("competitor-research", "search_competitors.py", { query }),
  }),
  new DynamicStructuredTool({
    name: "search_best_practices",
    description: "搜索行业最佳实践和常见做法。",
    schema: z.object({ topic: z.string().describe("搜索主题") }),
    func: async ({ topic }) =>
      callPythonTool("competitor-research", "search_best_practices.py", { topic }),
  }),
  new DynamicStructuredTool({
    name: "analyze_completeness",
    description: "分析需求描述的完整性，从六个维度检查是否缺少关键信息。",
    schema: z.object({ requirementText: z.string().describe("需求描述文本") }),
    func: async ({ requirementText }) =>
      callPythonTool("requirement-analysis", "analyze_completeness.py", {
        requirementText,
      }),
  }),
  new DynamicStructuredTool({
    name: "estimate_complexity",
    description: "估算需求的技术复杂度，返回 T-shirt size 和预计工期。",
    schema: z.object({ requirementText: z.string().describe("需求描述") }),
    func: async ({ requirementText }) =>
      callPythonTool("requirement-analysis", "estimate_complexity.py", {
        requirementText,
      }),
  }),
];

const agent = createDeepAgent({
  model: new ChatOpenAI({
    model: process.env.DEEPAGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: process.env.OPENAI_BASE_URL
      ? { baseURL: process.env.OPENAI_BASE_URL }
      : undefined,
  }),
  tools,
  backend: new FilesystemBackend({ rootDir: process.cwd() }),
  skills: [SKILLS_DIR],
  systemPrompt:
    "你是一位产品调研分析师。需要专业能力时，可以加载对应 skill，并输出结构清晰、可用于产品决策的竞品分析报告。",
});

console.log("=".repeat(80));
console.log("DeepAgent 产品调研 Demo（含 Skills 接入）");
console.log("=".repeat(80));

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "调研中小团队项目管理工具竞品，我们想做一个轻量级项目管理工具。",
    },
  ],
});

const toolCalls = result.messages
  .filter((m: { tool_calls?: { name: string }[] }) => (m.tool_calls?.length ?? 0) > 0)
  .flatMap((m: { tool_calls?: { name: string }[] }) =>
    (m.tool_calls ?? []).map((tc) => tc.name),
  );

const output = result.messages[result.messages.length - 1].content.toString();

console.log(`\n调用链: ${toolCalls.join(" → ")}`);
console.log(`todos: ${(result.todos ?? []).length} 项`);
console.log(`files: ${Object.keys(result.files ?? {}).join(", ") || "(无)"}`);
console.log("\nAgent 输出:");
console.log("─".repeat(80));
console.log(output);
console.log("─".repeat(80));
console.log(`输出长度: ${output.length} 字符`);
