# MVP 实施进度台账

本文件是项目内的唯一实施状态基线。每个 MVP 完成或状态变化时，都要同步更新状态、日期、验收证据和下一步，避免进度只保存在对话中。

## 总览

| MVP | 状态 | 最近更新 | 可体验结果 | 下一步 |
| --- | --- | --- | --- | --- |
| MVP-0 | 已完成 | 2026-09-08 | Web 可检查 API、模型配置和 tool calling | 已进入 MVP-1 |
| MVP-1 | 已完成（真实模型运行需显式授权） | 2026-09-09 | 单需求经 Root Agent 和需求专家生成流式报告及虚拟产物 | MVP-2 澄清与恢复 |
| MVP-2 | 未开始 | - | - | 等待启动 |
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
