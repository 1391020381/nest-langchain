import { MemorySaver } from "@langchain/langgraph";
import { createLearningModel } from "./model.js";
import { createRequirementGraph } from "./requirement.graph.js";

async function run() {
  const checkpointer = new MemorySaver();
  const graph = createRequirementGraph(createLearningModel(), {
    checkpointer,
    interruptBefore: ["actor"],
  });
  const config = {
    configurable: { thread_id: `langgraph-learning-${Date.now()}` },
  };

  await graph.invoke(
    { input: "分析 REQ-001：管理员导出用户手机号和身份证信息" },
    config,
  );
  const snapshot = await graph.getState(config);
  console.log("已暂停，下一节点：", snapshot.next);
  console.log("人工审核内容：\n", snapshot.values.analysisResult);

  await graph.updateState(config, {
    analysisResult: `${snapshot.values.analysisResult}\n\n# 人工补充\n导出文件必须在 24 小时后失效。`,
  });
  const result = await graph.invoke(null, config);
  console.log("\n恢复后的最终报告：\n", result.summary);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
