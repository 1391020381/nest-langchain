import { createLearningModel } from "./model.js";
import { createRequirementGraph } from "./requirement.graph.js";

const DEFAULT_INPUT =
  "分析需求 REQ-001：管理员可以导出用户手机号和身份证信息，支持中国和欧盟用户。";

function readInput() {
  const content = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  return content.join(" ") || DEFAULT_INPUT;
}

async function invokeDemo() {
  const graph = createRequirementGraph(createLearningModel());
  const result = await graph.invoke({ input: readInput() });
  console.log("意图：", result.intent);
  console.log("启用专家：", result.activeExperts.join(", ") || "无");
  console.log("修订次数：", result.reviseCount);
  console.log("\n最终报告：\n", result.summary);
}

async function streamDemo() {
  const graph = createRequirementGraph(createLearningModel());
  const stream = await graph.stream(
    { input: readInput() },
    { streamMode: "updates" },
  );
  for await (const update of stream) {
    console.log("节点更新：", JSON.stringify(update, null, 2));
  }
}

const run = process.argv.includes("--stream") ? streamDemo : invokeDemo;
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
