import { test } from "node:test";
import assert from "node:assert/strict";
import { configureResearchTracing } from "./research-tracing";

test("未开启追踪时不要求密钥或修改环境", () => {
  const env = { LANGSMITH_TRACING: "false" };
  assert.equal(configureResearchTracing(env).enabled, false);
  assert.deepEqual(env, { LANGSMITH_TRACING: "false" });
});
test("显式开启但没有密钥时立即报错", () => {
  assert.throws(() => configureResearchTracing({ LANGSMITH_TRACING: "true" }), /LANGSMITH_API_KEY/);
});
test("启用追踪使用默认项目并等待上传，保留自定义区域", () => {
  const env = { LANGSMITH_TRACING: "true", LANGSMITH_API_KEY: "test", LANGSMITH_ENDPOINT: "https://eu.api.smith.langchain.com" };
  assert.equal(configureResearchTracing(env).project, "deepagents-in-action-ch02");
  assert.equal((env as NodeJS.ProcessEnv).LANGCHAIN_CALLBACKS_BACKGROUND, "false");
  assert.equal(env.LANGSMITH_ENDPOINT, "https://eu.api.smith.langchain.com");
  assert.equal(configureResearchTracing({ ...env, LANGSMITH_PROJECT: "my-research" }).project, "my-research");
});
