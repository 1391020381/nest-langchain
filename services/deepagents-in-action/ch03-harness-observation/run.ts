import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";
import { ChatOpenAI } from "@langchain/openai";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

import {
  createObservedWeatherAgent,
  DEFAULT_HARNESS_QUESTION,
} from "./agent";
import { createHarnessObserver, readFileText } from "./observer";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

async function main() {
  const siliconflowKey = process.env.SILICONFLOW_API_KEY?.trim();
  const apiKey = siliconflowKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "缺少模型密钥。请先配置 services/deepagents-in-action/.env。",
    );
  }

  const model = new ChatOpenAI({
    apiKey,
    model: siliconflowKey
      ? process.env.MODEL_NAME || "Qwen/Qwen2.5-7B-Instruct"
      : process.env.DEEPAGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4",
    configuration: {
      baseURL: siliconflowKey
        ? "https://api.siliconflow.cn/v1"
        : process.env.OPENAI_BASE_URL,
    },
    temperature: 0,
    timeout: 60_000,
    maxRetries: 0,
  });

  const question =
    process.argv.slice(2).join(" ").trim() || DEFAULT_HARNESS_QUESTION;
  const agent = createObservedWeatherAgent(model).withConfig({
    runName: "ch03-harness-observation",
    tags: ["deepagents-in-action", "ch03-harness-observation"],
    metadata: { tutorial_stage: "deepagent-harness-observation" },
  });
  const observer = createHarnessObserver();

  console.log("任务:", question);
  console.log(
    "显式配置: model + systemPrompt + get_weather；Agent loop、Todo 和文件工具由 Harness 组装。",
  );

  const stream = await agent.stream(
    { messages: [{ role: "user", content: question }] },
    { streamMode: "values", recursionLimit: 30 },
  );
  for await (const state of stream) observer.observe(state);

  const final = observer.snapshot();
  const report = readFileText(final.files, "/work/weather-report.md");
  const incomplete = final.todos.filter((todo) => todo.status !== "completed");

  console.log("\n=== Harness 观察结论 ===");
  console.log(`消息数量: ${final.messages.length}`);
  console.log(`Todo: ${final.todos.length - incomplete.length}/${final.todos.length} 完成`);
  console.log(
    `虚拟文件: ${Object.keys(final.files).sort().join(", ") || "（空）"}`,
  );
  console.log("\n报告内容:\n", report || "未生成 /work/weather-report.md");

  if (!final.todos.length || incomplete.length > 0 || !report) {
    throw new Error(
      "Harness 未完成 Todo 或报告要求；请根据消息序列检查模型行为。",
    );
  }
}

main()
  .finally(() => awaitAllCallbacks())
  .catch((error: unknown) => {
    console.error(
      "Harness 观察失败:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });

