# DeepAgent 需求分析平台

本目录是一个全新的实施基线，用于把《AI Agents 开发实践》中逐步演进出来的“AI 需求分析系统”，改造成一个从第一天起就直接使用 DeepAgent 的独立项目。

它不是 `docs/deepagent-first` 的续写，也不是对 `services/chat` 的迁移。新项目只复用底层模型凭据的环境变量约定，不复用既有业务代码、Prompt、Agent、工具、协议、页面、数据库模型或运行时适配器。

## 1. 业务主线结论

《AI Agents 开发实践》里出现过两类案例：

- 第四章的“退货客服工单”用于讲解 Memory、Tools、向量和固定 Multi-Agent，是阶段性教学案例。
- 第六章以后贯穿 LangGraph、RAG、MCP、Skills、DeepAgent 和生产化章节的最终产品，是“AI 需求分析与交付工作台”。

因此，新项目采用第二条主线：产品经理或业务人员提交一条或多条软件需求，系统通过澄清、知识检索、专家分析、风险评审和汇总，生成可追溯的需求分析产物。

首期最终业务闭环是：

```text
提交需求
  -> 判断信息是否完整
  -> 必要时向用户澄清并恢复执行
  -> 检索企业知识和历史需求
  -> 委派领域专家分析
  -> 汇总风险、复杂度、用户故事和验收标准
  -> 用户查看并确认报告
  -> 持久化会话、运行记录和产物
```

“从需求自动生成并提交 PR”是文档第二十章的后续展望，不纳入首期需求分析 MVP。它应在需求分析质量、权限和人工审批机制稳定后单独立项。

## 2. 技术路线决策

新项目采用 **DeepAgent-only** 的业务编排方式：

- 所有需求分析请求都进入 DeepAgent，不再采用“短任务走手写 LangGraph、长任务才走 DeepAgent”的双轨路由。
- 根 Agent 负责任务规划、专家委派、进度维护和最终汇总。
- 子 Agent 分别负责需求、功能、性能、安全和合规等领域分析。
- 使用 DeepAgent 内置 `write_todos`、`task` 和虚拟文件系统支撑长链任务。
- 通过业务事件适配层把 DeepAgent/LangChain 的底层事件转换成稳定的前端事件协议。
- 允许使用 DeepAgent 底层依赖的 LangGraph checkpointer，但新业务代码不手写 `StateGraph` 编排流程。

换句话说，本项目学习的是“如何把业务装进 DeepAgent harness”，而不是再重复一次 LangChain -> LangGraph -> DeepAgent 的迁移过程。

## 3. 文档导航

- [业务需求](./01-business-requirements.md)：用户、场景、功能、非功能要求和范围边界。
- [闭环 MVP 路线](./02-mvp-roadmap.md)：每一步的输入、处理、输出、验收和退出条件。
- [目录与复用边界](./03-directory-and-reuse-boundaries.md)：全新目录、模块职责和唯一允许复用的配置。
- [MVP-0 实施说明](./04-mvp0-implementation.md)：工程结构、诊断链路、启动体验和排错方式。
- [MVP-1 实施说明](./05-mvp1-implementation.md)：单需求 Agent、SSE、取消、产物和测试闭环。
- [MVP-2 实施说明](./06-mvp2-implementation.md)：真实中断、结构化澄清、同线程恢复和幂等。
- [实施进度台账](./PROGRESS.md)：每个 MVP 的状态、日期、验收证据和下一步。

## 4. 参考章节与本项目取舍

| 原文阶段 | 可借鉴的业务能力 | 新项目处理方式 |
| --- | --- | --- |
| 第四章 | 多轮上下文、工具、制品、多个专职角色 | 借鉴模式，不沿用退货客服业务 |
| 第六章 | 需求提交、结构化交互、进度和报告 | 作为产品交互主线 |
| 第八章 | 澄清、分析、风险、质量闭环、HITL | 改为 DeepAgent 规划和子 Agent 协作 |
| 第九章 | 功能、性能、安全、合规专家 | 直接定义为 DeepAgent subagents |
| 第十一章 | 企业知识检索和 RAG | 包装成 DeepAgent tool |
| 第十二章 | 外部业务能力标准化接入 | 在本地工具闭环后增加 MCP 适配 |
| 第十三章 | 分析方法论沉淀 | 作为 Skills/上下文资源按需加载 |
| 第十四、十五章 | todos、subagent、VFS、checkpointer、HITL | 成为项目的基础运行方式 |
| 第二十章 | Web -> API -> Agent -> SSE -> Artifact 的完整链路 | 作为最终端到端验收模板 |

## 5. 当前状态

MVP-0、MVP-1 与 MVP-2 已实施：在独立 workspace 中完成模型诊断、单需求分析，以及不完整需求通过 `interrupt()` 暂停并以相同 `runId/threadId` 恢复的闭环。默认自动测试不会调用外部模型，真实模型验收必须显式开启。旧业务目录没有被修改或引入。
