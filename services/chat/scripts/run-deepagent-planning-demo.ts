/**
 * DeepAgent 自主规划 Demo
 *
 * 学习目标：
 * 1. 观察 write_todos 如何创建计划
 * 2. 观察 Agent 如何更新 todo 状态
 * 3. 区分业务工具和 DeepAgent 内置工具
 *
 * 运行：
 * cd services/chat
 * bun run scripts/run-deepagent-planning-demo.ts
 */

import { createDeepAgent, FilesystemBackend } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { config } from "dotenv";
import { join } from "path";
import { z } from "zod";
import { callPythonTool } from "../src/skills/call-python-tool";

// 读取 services/chat/.env
config({ path: join(import.meta.dir, "../.env") });

if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "缺少 OPENAI_API_KEY，请先配置 services/chat/.env",
  );
}

/**
 * 业务工具 1：搜索竞品
 *
 * write_todos 不需要在这里注册。
 * 它由 createDeepAgent 自动注入。
 */
const searchCompetitors = new DynamicStructuredTool({
  name: "search_competitors",
  description: "搜索项目管理工具竞品，返回名称、定位、定价和主要功能。",
  schema: z.object({
    query: z.string().describe("竞品搜索关键词"),
  }),
  func: async ({ query }) =>
    callPythonTool(
      "competitor-research",
      "search_competitors.py",
      { query },
    ),
});

/**
 * 业务工具 2：搜索行业最佳实践
 */
const searchBestPractices = new DynamicStructuredTool({
  name: "search_best_practices",
  description: "搜索项目管理产品的行业最佳实践。",
  schema: z.object({
    topic: z.string().describe("需要研究的主题"),
  }),
  func: async ({ topic }) =>
    callPythonTool(
      "competitor-research",
      "search_best_practices.py",
      { topic },
    ),
});

/**
 * 这里明确告诉模型：
 *
 * 1. 必须先使用 write_todos
 * 2. todos 应该包含什么
 * 3. 每完成一步都要更新状态
 *
 * DeepAgent 会把这段业务提示词和自己的内置提示词组合起来。
 */
// const PLANNING_SYSTEM_PROMPT = `
// 你是一位产品调研分析师。

// 本次 Demo 的主要目标是演示自主规划，因此必须遵守下面的工作流程：

// 1. 收到调研任务后，必须先调用 write_todos 创建任务计划。
// 2. 计划至少包含以下四个步骤：
//    - 搜索主要竞品
//    - 搜集行业最佳实践
//    - 对比竞品并提炼结论
//    - 输出最终调研报告
// 3. 同一时间最多只能有一个 todo 是 in_progress。
// 4. 每完成一个步骤，都要再次调用 write_todos：
//    - 把当前步骤改成 completed
//    - 把下一个步骤改成 in_progress
// 5. 全部工作完成后，再次调用 write_todos，
//    把所有步骤更新为 completed。
// 6. 这次演示不要使用文件系统，也不要委派给子 Agent。
// 7. 最终输出一份结构清晰的 Markdown 调研报告。
// `.trim();
const PLANNING_SYSTEM_PROMPT = `
你是一位产品调研分析师。

必须遵守以下流程：

1. 首先调用一次 write_todos 创建计划。
2. 每轮最多调用一次 write_todos，禁止并行调用多个 write_todos。
3. 使用 search_competitors 搜索 Asana 和 Trello。
4. 必须使用文件系统工具：
   - 将 Asana 分析写入 /.deepagent-work/asana.md
   - 将 Trello 分析写入 /.deepagent-work/trello.md
   - 写入后重新读取这两个文件
5. 每完成一个阶段，调用一次 write_todos，同时：
   - 将当前任务标记为 completed
   - 将下一项标记为 in_progress
6. 不要调用 task，不要创建子 Agent。
7. 读取两个文件后，根据读取结果生成最终 Markdown 对比报告。
8. 最后把所有 todo 标记为 completed。
9. todos 全部完成后，禁止再次调用任何工具，直接输出最终报告并结束。
`.trim();

const model = new ChatOpenAI({
  model:
    process.env.DEEPAGENT_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-5.4",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: process.env.OPENAI_BASE_URL
    ? {
        baseURL: process.env.OPENAI_BASE_URL,
      }
    : undefined,
});
const backend = new FilesystemBackend({
      rootDir:process.cwd(),
      virtualMode:true

})
/**
 * createDeepAgent 会自动注入：
 *
 * - write_todos
 * - ls/read_file/write_file/edit_file/glob/grep
 * - task
 * - summarization
 *
 * 这里的 tools 只需要填写业务工具。
 */
const agent = createDeepAgent({
  model,
  tools: [
    searchCompetitors,
    searchBestPractices,
  ],
  backend,
  systemPrompt: PLANNING_SYSTEM_PROMPT,
});

// const userTask = [
//   "请调研适合 10～50 人团队使用的轻量级项目管理工具。",
//   "",
//   "我们准备开发一个新产品，请完成以下工作：",
//   "1. 搜索主要竞品。",
//   "2. 搜集项目管理产品的行业最佳实践。",
//   "3. 对比竞品的定位、功能和定价。",
//   "4. 给出我们的产品差异化建议。",
//   "",
//   "开始执行前，必须先调用 write_todos 制定计划；",
//   "每完成一个步骤，都要更新 todo 状态。",
// ].join("\n");

const userTask = [
  "请调研 Asana 和 Trello。",
  "",
  "执行要求：",
  "1. 先调用 write_todos 制定计划。",
  "2. 搜索 Asana 和 Trello 的竞品信息。",
  "3. 将 Asana 分析写入 /.deepagent-work/asana.md。",
  "4. 将 Trello 分析写入 /.deepagent-work/trello.md。",
  "5. 重新读取这两个文件。",
  "6. 根据文件内容生成最终对比报告。",
  "7. 每完成一步都更新 todos。",
].join("\n");

console.log("=".repeat(80));
console.log("DeepAgent 自主规划 Demo");
console.log("=".repeat(80));
console.log("\n用户任务：");
console.log(userTask);
console.log("\nAgent 开始执行……\n");

const result = await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content: userTask,
      },
    ],
  },
  {
    // 防止模型或工具异常循环
    recursionLimit: 100,
  },
);

/**
 * 从消息历史中提取所有工具调用。
 *
 * 一次 invoke 可能产生：
 *
 * AIMessage(write_todos)
 * ToolMessage(执行结果)
 * AIMessage(search_competitors)
 * ToolMessage(执行结果)
 * AIMessage(write_todos)
 * ...
 */
 
console.log('restult:', result);


type ToolCallRecord = {
  name: string;
  args: unknown;
};

const toolCalls: ToolCallRecord[] = result.messages.flatMap(
  (message: {
    tool_calls?: Array<{
      name?: string;
      args?: unknown;
    }>;
  }) =>
    (message.tool_calls ?? []).map((toolCall) => ({
      name: toolCall.name ?? "unknown",
      args: toolCall.args,
    })),
);

const usedWriteFile = toolCalls.some(
  (toolCall) => toolCall.name === "write_file",
);

const usedReadFile = toolCalls.some(
  (toolCall) =>
    toolCall.name === "read_file" &&
    JSON.stringify(toolCall.args).includes(".deepagent-work"),
);

console.log("调用 write_file:", usedWriteFile ? "✅" : "❌");
console.log("调用 read_file:", usedReadFile ? "✅" : "❌");

const asanaFile = await backend.read(
  "/.deepagent-work/asana.md",
);

const trelloFile = await backend.read(
  "/.deepagent-work/trello.md",
);

console.log(
  "Asana 文件:",
  asanaFile.error ? "❌" : "✅",
);

console.log(
  "Trello 文件:",
  trelloFile.error ? "❌" : "✅",
);

console.log("Asana 内容:", asanaFile.content);
console.log("Trello 内容:", trelloFile.content);

console.log("=".repeat(80));
console.log("1. 工具调用链");
console.log("=".repeat(80));
console.log(
  toolCalls.map((toolCall) => toolCall.name).join(" → ") ||
    "没有工具调用",
);

/**
 * write_todos 会被多次调用。
 * 这里把每次提交的 todo 内容都打印出来，
 * 方便观察计划状态如何变化。
 */
const todoUpdates = toolCalls.filter(
  (toolCall) => toolCall.name === "write_todos",
);

console.log("\n" + "=".repeat(80));
console.log("2. write_todos 更新历史");
console.log("=".repeat(80));

if (todoUpdates.length === 0) {
  console.log("本次没有调用 write_todos。");
  console.log("请检查模型是否稳定支持 tool calling。");
} else {
  todoUpdates.forEach((update, index) => {
    console.log(`\n第 ${index + 1} 次更新：`);
    console.log(JSON.stringify(update.args, null, 2));
  });
}

/**
 * result.todos 是 Agent 执行结束时的最终 todo 状态，
 * 不是完整更新历史。
 */
console.log("\n" + "=".repeat(80));
console.log("3. 最终 todos");
console.log("=".repeat(80));
console.log(JSON.stringify(result.todos ?? [], null, 2));

const lastMessage =
  result.messages[result.messages.length - 1];

const finalOutput =
  typeof lastMessage?.content === "string"
    ? lastMessage.content
    : JSON.stringify(lastMessage?.content ?? "", null, 2);

console.log("\n" + "=".repeat(80));
console.log("4. 最终调研报告");
console.log("=".repeat(80));
console.log(finalOutput);