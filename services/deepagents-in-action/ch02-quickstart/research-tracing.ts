/** 在 .env 加载后、Agent 创建前配置 LangChain 的自动追踪。 */
export function configureResearchTracing(env: NodeJS.ProcessEnv = process.env) {
  const enabled = env.LANGSMITH_TRACING?.trim().toLowerCase() === "true";
  if (!enabled) return { enabled: false, project: undefined };
  if (!env.LANGSMITH_API_KEY?.trim()) {
    throw new Error("已启用 LangSmith，但缺少 LANGSMITH_API_KEY，请配置 .env 或设置 LANGSMITH_TRACING=false");
  }
  env.LANGSMITH_TRACING = "true";
  env.LANGSMITH_PROJECT = env.LANGSMITH_PROJECT?.trim() || "deepagents-in-action-ch02";
  // 命令行运行结束前等待根 trace 上传，防止短脚本退出时丢失记录。
  env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";
  return { enabled: true, project: env.LANGSMITH_PROJECT };
}
