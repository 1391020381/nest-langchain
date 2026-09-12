# MVP 实施进度台账

本文件是项目内的唯一实施状态基线。每个 MVP 完成或状态变化时，都要同步更新状态、日期、验收证据和下一步，避免进度只保存在对话中。

## 总览

| MVP | 状态 | 最近更新 | 可体验结果 | 下一步 |
| --- | --- | --- | --- | --- |
| MVP-0 | 已完成 | 2026-09-08 | Web 可检查 API、模型配置和 tool calling | 已进入 MVP-1 |
| MVP-1 | 已完成（真实模型运行需显式授权） | 2026-09-09 | 单需求经 Root Agent 和需求专家生成流式报告及虚拟产物 | MVP-2 澄清与恢复 |
| MVP-2 | 已完成（真实模型运行需显式授权） | 2026-09-09 | 信息不完整时真实暂停，在同一 run/thread 提交答案后恢复 | MVP-3 按需多专家协作 |
| MVP-3 | 未开始 | - | - | 等待启动 |
| MVP-4 | 未开始 | - | - | 等待启动 |
| MVP-5 | 未开始 | - | - | 等待启动 |
| MVP-6 | 未开始 | - | - | 等待启动 |
| MVP-7 | 未开始 | - | - | 等待启动 |
| MVP-8 | 未开始 | - | - | 等待启动 |

## MVP-0 验收记录

- 新建 `requirement-deepagent-contracts`、`requirement-deepagent-api`、`requirement-deepagent-web` 三个独立 workspace。
- 只通过允许列表读取模型环境变量，没有引用旧业务模块。
- liveness、readiness、tool-calling 诊断、Web 状态页、构建和确定性测试均已通过。

## MVP-1 验收记录

完成内容：

- 新建 `requirement-coordinator` Root Agent 和 `requirement-analyst` 子 Agent。
- Root Agent 使用 DeepAgent 内置 `write_todos`、`task`、`write_file` 完成规划、唯一一次委派和最终报告落盘。
- 新增 POST SSE 接口 `POST /api/agent/runs/stream`，以业务事件输出计划、Agent、工具、产物、报告和终态。
- 新增超时、AbortSignal 取消、公开错误转换和唯一终态保证。
- 从 StateBackend 导出 `/work/final-report.md`，协议明确标记为虚拟产物，不把它当作本机路径。
- Web 升级为单需求工作台，可输入、取消、查看轨迹、todos、Markdown 报告和产物。

自动验收证据（2026-09-09）：

- `bun run typecheck:requirement-deepagent`：通过。
- `bun run test:requirement-deepagent`：20 个测试通过，真实模型测试 1 个按设计跳过。其中脚本模型集成测试真实运行 DeepAgent 的 `write_todos`、`task`、`write_file` 和 StateBackend 导出链路，但不访问网络。
- `bun run build:requirement-deepagent`：API 和 Web 生产构建通过。
- 真实模型测试已提供 `RUN_LIVE_REQUIREMENT_AGENT_TESTS=1` 显式开关；由于它会把需求正文发送到外部模型，本次未在没有用户明确授权的情况下自动执行。

完成定义：代码、确定性测试、类型检查、生产构建和可操作说明均已完成；外部模型运行属于显式选择的集成验收，不进入默认测试。

## MVP-2 验收记录

完成内容：

- 新增结构化完整性结果、澄清问题和答案协议。
- 新增 `request_requirement_clarification` 工具，使用 LangGraph `interrupt()` 真实暂停 DeepAgent 图。
- Agent 工厂配置 `MemorySaver`；运行时使用相同 `thread_id` 和 `Command({ resume })` 恢复原检查点。
- 新增 `clarification.required`、`run.paused`、`run.resumed` 事件，暂停前后保持相同 run/thread 和连续 sequence。
- 新增恢复和等待态放弃接口，校验运行归属、问题 id、必填答案与幂等 requestId。
- Web 新增待澄清示例、动态问题表单、继续原运行和放弃操作。
- 明确当前检查点只在 API 进程内有效，跨重启恢复仍由 MVP-4 实现。

自动验收证据（2026-09-09）：

- `bun run test:requirement-deepagent`：26 个测试通过，真实模型测试 2 个按设计跳过。脚本模型测试真实执行 DeepAgent interrupt/checkpoint/resume 链路，不访问网络。
- `bun run typecheck:requirement-deepagent`：通过。
- `bun run build:requirement-deepagent`：API 和 Web 生产构建通过。
- 真实模型测试仍由 `RUN_LIVE_REQUIREMENT_AGENT_TESTS=1` 显式开启，本次没有自动向外部模型发送需求或答案。

完成定义：不完整需求可以暂停、回答、同运行恢复或放弃；恢复幂等和关键错误分支有确定性测试，代码、说明与进度台账同步完成。
