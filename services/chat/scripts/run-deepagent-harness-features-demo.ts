/**
 * DeepAgent Harness 综合 Demo
 *
 * 一次验证四个能力：
 * 1. write_todos：主 Agent 自主规划
 * 2. backend：中间结果写入真实磁盘并重新读取
 * 3. skills：按需读取 competitor-research/SKILL.md
 * 4. subagents：主 Agent 通过 task 委派给 competitor-analyst
 *
 * 运行：
 * cd services/chat
 * bun run demo:deepagent-harness
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import {
  createDeepAgent,
  FilesystemBackend,
  listSkills,
  type SubAgent,
} from "deepagents";
import { config } from "dotenv";
import { join } from "path";
import { z } from "zod";
import {
  callPythonTool,
  SKILLS_DIR,
} from "../src/skills/call-python-tool";

config({ path: join(import.meta.dir, "../.env") });

if (!process.env.OPENAI_API_KEY) {
  throw new Error("缺少 OPENAI_API_KEY，请先配置 services/chat/.env");
}

const WORK_DIR = "/.deepagent-work/harness-features";
const ASANA_FILE = `${WORK_DIR}/asana.md`;
const TRELLO_FILE = `${WORK_DIR}/trello.md`;
const SKILLS_PATH = "/src/skills/definitions/";

const searchCompetitors = new DynamicStructuredTool({
  name: "search_competitors",
  description: "搜索指定竞品的定位、功能、定价和优劣势。",
  schema: z.object({
    query: z.string().describe("竞品名称或搜索关键词"),
  }),
  func: async ({ query }) =>
    callPythonTool("competitor-research", "search_competitors.py", { query }),
});

const searchBestPractices = new DynamicStructuredTool({
  name: "search_best_practices",
  description: "搜索项目管理产品的行业最佳实践。",
  schema: z.object({
    topic: z.string().describe("需要研究的主题"),
  }),
  func: async ({ topic }) =>
    callPythonTool("competitor-research", "search_best_practices.py", { topic }),
});

const model = new ChatOpenAI({
  model:
    process.env.DEEPAGENT_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-5.4",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: process.env.OPENAI_BASE_URL
    ? { baseURL: process.env.OPENAI_BASE_URL }
    : undefined,
});

/**
 * Backend 是文件系统的存储层。
 * 这里把虚拟路径 /xxx 映射到 services/chat/xxx，
 * virtualMode 会阻止 .. 和 ~ 越出 services/chat。
 */
const backend = new FilesystemBackend({
  rootDir: process.cwd(),
  virtualMode: true,
});

/**
 * SubAgent 是一个拥有独立 system prompt、tools 和上下文的 Agent。
 * 主 Agent 不会直接进入它的上下文，而是通过 task 工具发送任务，
 * 最后只接收子 Agent 的结果。
 *
 * 自定义 SubAgent 默认不继承主 Agent 的 skills，
 * 因此这里要显式声明 skills: [SKILLS_PATH]。
 */
const competitorAnalyst: SubAgent = {
  name: "competitor-analyst",
  description:
    "单竞品分析专家，负责分析一个项目管理产品的定位、功能、定价、优劣势和适用团队。",
  systemPrompt: `
你是单竞品分析专家，每次只分析一个竞品。

必须按以下顺序执行：
1. 先读取 competitor-research Skill，理解竞品调研方法。
2. 调用 search_competitors 搜集竞品资料。
3. 必要时调用 search_best_practices 补充行业最佳实践。
4. 返回 Markdown 格式的分析结果，必须包含定位、功能、定价、优势、劣势和适用团队。
`.trim(),
  model,
  tools: [searchCompetitors, searchBestPractices],
  skills: [SKILLS_PATH],
};

const agent = createDeepAgent({
  model,

  // 主 Agent 不注册搜索工具，防止它跳过 task 自己做详细分析。
  tools: [],
  backend,
  skills: [SKILLS_PATH],
  subagents: [competitorAnalyst],
  systemPrompt: `
你是竞品调研项目的主协调者。

必须严格执行下面的流程：
1. 先调用 write_todos 制定完整计划，每完成一步都更新 todos。
2. 读取 competitor-research Skill，用它作为最终汇总的方法规范。
3. 调用 task，把 Asana 委派给 competitor-analyst。
4. 把 Asana 子 Agent 返回的完整结果写入 ${ASANA_FILE}。
5. 调用 task，把 Trello 委派给 competitor-analyst。
6. 把 Trello 子 Agent 返回的完整结果写入 ${TRELLO_FILE}。
7. 重新读取上述两个文件，不要凭记忆汇总。
8. 输出最终对比报告，并把所有 todos 标记为 completed。

主 Agent 只负责规划、委派、文件保存和汇总，不得代替子 Agent 搜索竞品。
`.trim(),
});

type ToolCallRecord = {
  name: string;
  args: unknown;
};

function unwrapToolArgs(data: unknown): unknown {
  const raw = (data as { input?: unknown } | undefined)?.input;
  const inner =
    raw && typeof raw === "object" && "input" in raw
      ? (raw as { input: unknown }).input
      : raw;

  if (typeof inner === "string") {
    try {
      return JSON.parse(inner);
    } catch {
      return inner;
    }
  }

  return inner;
}

function includesArg(call: ToolCallRecord, value: string): boolean {
  return JSON.stringify(call.args ?? "").includes(value);
}

function finalText(state: unknown): string {
  const messages =
    (state as { messages?: Array<{ content: unknown }> } | null)?.messages ?? [];
  const last = messages[messages.length - 1];

  if (!last) return "（未捕获到最终回复）";
  return typeof last.content === "string"
    ? last.content
    : JSON.stringify(last.content, null, 2);
}

const discoveredSkills = listSkills({
  projectSkillsDir: SKILLS_DIR,
});

console.log("=".repeat(80));
console.log("DeepAgent Backend + Skills + SubAgents 综合 Demo");
console.log("=".repeat(80));
console.log(
  "启动前发现的 Skills:",
  discoveredSkills.map((skill) => skill.name).join(", ") || "（无）",
);

const task = [
  "请分别调研 Asana 和 Trello，并生成一份面向 10～50 人团队的选型对比报告。",
  "Asana 和 Trello 必须分别委派给 competitor-analyst。",
  `中间结果必须分别写入 ${ASANA_FILE} 和 ${TRELLO_FILE}。`,
].join("\n");

const toolCalls: ToolCallRecord[] = [];
let rootRunId: string | undefined;
let finalState: unknown;

for await (const event of agent.streamEvents(
  { messages: [{ role: "user", content: task }] },
  { version: "v2", recursionLimit: 60 },
)) {
  if (!rootRunId && event.event === "on_chain_start") {
    rootRunId = event.run_id;
  }

  if (event.event === "on_tool_start") {
    const call = {
      name: event.name,
      args: unwrapToolArgs(event.data),
    };
    toolCalls.push(call);
    console.log(`🔧 ${call.name}: ${JSON.stringify(call.args).slice(0, 180)}`);
  }

  if (event.event === "on_chain_end" && event.run_id === rootRunId) {
    finalState = (event.data as { output?: unknown }).output;
  }
}

const asanaResult = await backend.read(ASANA_FILE);
const trelloResult = await backend.read(TRELLO_FILE);

const checks = [
  {
    name: "write_todos 自主规划",
    passed: toolCalls.some((call) => call.name === "write_todos"),
  },
  {
    name: "Skills 启动前发现",
    passed: discoveredSkills.some(
      (skill) => skill.name === "competitor-research",
    ),
  },
  {
    name: "Skills 运行时读取 SKILL.md",
    passed: toolCalls.some(
      (call) => call.name === "read_file" && includesArg(call, "SKILL.md"),
    ),
  },
  {
    name: "SubAgent 通过 task 被委派两次",
    passed:
      toolCalls.filter(
        (call) =>
          call.name === "task" && includesArg(call, "competitor-analyst"),
      ).length >= 2,
  },
  {
    name: "Backend 写入 Asana 文件",
    passed: !asanaResult.error,
  },
  {
    name: "Backend 写入 Trello 文件",
    passed: !trelloResult.error,
  },
  {
    name: "Backend 重新读取工作文件",
    passed: toolCalls.some(
      (call) => call.name === "read_file" && includesArg(call, WORK_DIR),
    ),
  },
];

console.log("\n" + "=".repeat(80));
console.log("工具调用链");
console.log("=".repeat(80));
console.log(toolCalls.map((call) => call.name).join(" → "));

console.log("\n" + "=".repeat(80));
console.log("功能验收");
console.log("=".repeat(80));
for (const check of checks) {
  console.log(`${check.passed ? "✅" : "❌"} ${check.name}`);
}

console.log("\n" + "=".repeat(80));
console.log("最终报告");
console.log("=".repeat(80));
console.log(finalText(finalState));
