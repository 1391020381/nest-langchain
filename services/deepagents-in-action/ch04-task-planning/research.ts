import { ChatOpenAI } from "@langchain/openai";
import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createInternetSearch } from "../ch02-quickstart/research-tools";
import { configureResearchTracing } from "../ch02-quickstart/research-tracing";
import { createPlanningAgent, defaultQuestion } from "./agent";
import { createProgressReporter, readReport } from "./progress";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
async function main() {
  const tracing = configureResearchTracing();
  if (tracing.enabled) console.log(`LangSmith 项目: ${tracing.project}，运行: ch04-planning-research`);
  const search = createInternetSearch(process.env.TAVILY_API_KEY || "");
  const siliconflowKey = process.env.SILICONFLOW_API_KEY?.trim();
  const apiKey = siliconflowKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("请在 .env 配置 SILICONFLOW_API_KEY 或 OPENAI_API_KEY");
  const model = new ChatOpenAI({
    apiKey,
    model: siliconflowKey ? process.env.MODEL_NAME || "Qwen/Qwen2.5-7B-Instruct"
      : process.env.DEEPAGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4",
    configuration: { baseURL: siliconflowKey ? "https://api.siliconflow.cn/v1" : process.env.OPENAI_BASE_URL },
    temperature: 0, timeout: 60_000, maxRetries: 0,
  });
  const agent = createPlanningAgent(model, search);
  const question = process.argv.slice(2).join(" ").trim() || defaultQuestion;
  console.log("研究任务:", question);
  const reportProgress = createProgressReporter();
  const configured = agent.withConfig({
    runName: "ch04-planning-research",
    tags: ["deepagents-in-action", "ch04-task-planning"],
    metadata: { tutorial_chapter: "ch04-task-planning", search_provider: "tavily" },
  });
  const stream = await configured.stream({ messages: [{ role: "user", content: question }] }, {
    streamMode: "values", recursionLimit: 80,
  });
  let lastState;
  for await (const state of stream) {
    reportProgress(state);
    lastState = state;
  }
  if (!lastState) throw new Error("未收到 Agent 状态");
  const { todos, files } = reportProgress(lastState);
  const report = readReport(files);
  console.log("\n研究报告:\n", report || lastState.messages.at(-1)?.content || "未生成报告");
  console.log(`\n[执行结果] ${todos.filter((todo) => todo.status === "completed").length}/${todos.length} 项完成；${Object.keys(files).length} 个虚拟文件`);
  if (!todos.length || todos.some((todo) => todo.status !== "completed") || !report) {
    console.warn("本次未完整完成规划流程，请检查清单与报告文件；脚本不会替模型标记完成。");
    process.exitCode = 1;
  }
}
main().finally(() => awaitAllCallbacks()).catch((error: unknown) => {
  console.error("规划研究失败:", error instanceof Error ? error.message : "未知错误");
  process.exitCode = 1;
});
