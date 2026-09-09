import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { AgentService } from "../src/agent/agent.service";
import { DeepAgentRuntime } from "../src/agent/runtime/deepagent.runtime";
import { loadAllowedModelEnvironment } from "../src/bootstrap/load-model-env";
import { readRequirementRuntimeConfig } from "../src/model/model.config";

const enabled = process.env.RUN_LIVE_REQUIREMENT_AGENT_TESTS === "1";

describe.skipIf(!enabled)("live requirement DeepAgent", () => {
  it(
    "delegates once and exports a complete report",
    async () => {
      loadAllowedModelEnvironment(resolve(import.meta.dir, ".."));
      const service = new AgentService(
        new DeepAgentRuntime(),
        readRequirementRuntimeConfig(),
      );
      const events = [];
      for await (const event of service.stream({
        input:
          "作为企业管理员，我需要批量导入 Excel 成员数据，单次最多 10,000 行；校验失败的记录可以下载；所有导入操作必须保留审计日志。",
        threadId: "live-mvp1-test",
      })) {
        events.push(event);
      }

      const completed = events.find((event) => event.type === "report.completed");
      expect(completed?.type).toBe("report.completed");
      if (completed?.type === "report.completed") {
        expect(completed.artifacts.some((item) => item.path === "/work/final-report.md")).toBe(true);
        for (const heading of ["需求摘要", "风险", "用户故事", "验收标准"]) {
          expect(completed.report).toContain(heading);
        }
      }
      expect(events.at(-1)).toMatchObject({ type: "run.done", status: "completed" });
    },
    360_000,
  );
});
