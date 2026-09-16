# 第 4 章：让 Agent 规划并执行研究任务

对应[教程实战](https://datawhalechina.github.io/deepagents-in-action/chapters/ch04-task-planning/)。默认比较 Deep Agents、Claude Agent SDK、Codex SDK，模型自主拆分计划、搜索、整理笔记和撰写报告。

在 `services/deepagents-in-action` 中运行：

```powershell
bun run planning
bun run planning "调研 LangGraph、Temporal 和 Prefect 的适用场景，写一份带来源的比较报告。"
```

复用本项目 `.env` 的模型、Tavily 和可选 LangSmith 配置。追踪运行名为 `ch04-planning-research`，项目名仍由 `LANGSMITH_PROJECT` 控制。长任务需要支持工具调用且规划能力较强的模型，以及可用的模型和搜索额度。

- `agent.ts` 定义工作要求；锁定的 JS `deepagents@1.10.2` 内置 `todoListMiddleware()`，与教程 Python v0.7 显式启用的方式不同，不重复注册。
- `research.ts` 使用 `streamMode: "values"` 读取执行后的状态。
- `progress.ts` 在任务变化时打印 pending / in_progress / completed，在虚拟文件新增时打印路径。

预期过程：计划 → 搜索 → `/research/` 笔记 → 读取比较 → `/research/report.md` → 报告与完成清单。实际步骤由模型决定；清单未完成或缺少报告文件时提示并以非零状态退出。

文件位于默认 StateBackend 内存状态，不是本机磁盘文件，进程退出后不保留。脚本不伪造搜索、不代替模型更新完成状态。模型额度不足（如 HTTP 402）需要先解决对应平台配置。
