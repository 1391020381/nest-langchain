# AI Agents 开发实践 · 学习路线

本仓库已切换为《AI Agents 开发实践》跟书路线。

- **课本**：[`docs/AI Agents 开发实践/`](./AI%20Agents%20开发实践/)
- **工程**：按章从零在本仓库生成（Bun monorepo：`clients/` / `services/` / `packages/`）
- **对照参考**（只读）：[Cookieboty/autix-demo](https://github.com/Cookieboty/autix-demo) 各章 `feat/*` 分支
- **旧 Nest 练习文档**：已移至 [`docs/archive/`](./archive/)，不再作为主线

学习方式：读章 → 按章内步骤/Prompt 在本仓实现 → 对照验收点 → 勾选进度 → 进入下一章。

## 当前学习进度

- [x] 序章：站在范式之变的十字路口
- [x] 第一章：把模型变成能力
- [x] 第二章：搭建智能体的工程底座
- [ ] 第 2.5 章：用 AI 接管工程化开发
- [ ] 第三章：LangChain 起手——第一条服务端能力链路
- [ ] 第四章：LangChain 进阶——记忆、工具与多 Agent
- [ ] 第五章：从 Mock 到生产——数据库与向量化落库
- [ ] 第六章：让 AI 做更懂你的交互
- [ ] 第七章：Agent 推理的三层决策机制
- [ ] 第八章：LangGraph 单 Agent 图实战
- [ ] 第九章：LangGraph Multi-Agent 实战
- [ ] 第十章：Token 经济学
- [ ] 第十一章：RAG
- [ ] 第十二章：MCP
- [ ] 第十三章：Skills
- [ ] 第十四章：DeepAgent（Harness）
- [ ] 第十五章：DeepAgent（长链任务与自主规划）
- [ ] 第十六章：可观测性
- [ ] 第十七章：评估流水线
- [ ] 第十八章：安全、沙箱与权限隔离
- [ ] 第十九章：工程化交付——CI/CD
- [ ] 第二十章：满血版 MVP
- [ ] 终章：复盘与前瞻
- [ ] 面试篇：Agent 基础与编排

当前下一步：阅读并实践 **第 2.5 章**（AI 工程节奏 + RBAC 用户系统）。

## 章节索引

| 进度 | 章节 | 课本 | 官方对照分支（可选） |
| --- | --- | --- | --- |
| [x] | 序章 | [1-序章](./AI%20Agents%20开发实践/1-序章：站在范式之变的十字路口.md) | — |
| [x] | 第一章 | [2-第一章](./AI%20Agents%20开发实践/2-第一章：把模型变成能力.md) | — |
| [x] | 第二章 | [3-第二章](./AI%20Agents%20开发实践/3-第二章：搭建智能体的工程底座.md) | [feat/foundation](https://github.com/Cookieboty/autix-demo/tree/feat/foundation) |
| [ ] | 第 2.5 章 | [4-第2.5章](./AI%20Agents%20开发实践/4-第2.5章：用%20AI%20接管工程化开发：从工程底座到能力链路.md) | [feat/user-system](https://github.com/Cookieboty/autix-demo/tree/feat/user-system) |
| [ ] | 第三章 | [5-第三章](./AI%20Agents%20开发实践/5-第三章：LangChain%20起手——搭建第一条服务端能力链路.md) · [API 流程速查](./5a-第三章附录：LangChain%20编程%20API%20使用流程速查.md) | — |
| [ ] | 第四章 | [6-第四章](./AI%20Agents%20开发实践/6-第四章：LangChain%20进阶——记忆、工具与多%20Agent.md) | — |
| [ ] | 第五章 | [7-第五章](./AI%20Agents%20开发实践/7-第五章：从%20Mock%20到生产——数据库设计与向量化落库.md) | — |
| [ ] | 第六章 | [8-第六章](./AI%20Agents%20开发实践/8-第六章：让%20AI%20做更懂你的交互.md) | feat/ui（文中提及） |
| [ ] | 第七章 | [9-第七章](./AI%20Agents%20开发实践/9-第七章：Agent%20推理的三层决策机制：路由、执行与优化.md) | — |
| [ ] | 第八章 | [10-第八章](./AI%20Agents%20开发实践/10-第八章：LangGraph%20单%20Agent%20图实战——路由、循环与质量闭环.md) | [feat/LangGraph](https://github.com/Cookieboty/autix-demo/tree/feat/LangGraph) |
| [ ] | 第九章 | [11-第九章](./AI%20Agents%20开发实践/11-第九章：LangGraph%20Multi-Agent%20实战.md) | [feat/LangGraph](https://github.com/Cookieboty/autix-demo/tree/feat/LangGraph) |
| [ ] | 第十章 | [12-第十章](./AI%20Agents%20开发实践/12-第十章：Token%20经济学：在%20AI%20能力与运行成本之间寻找平衡.md) | [feat/token](https://github.com/Cookieboty/autix-demo/tree/feat/token) |
| [ ] | 第十一章 | [13-第十一章](./AI%20Agents%20开发实践/13-第十一章：RAG——让AI更懂你的业务.md) | [feat/rag](https://github.com/Cookieboty/autix-demo/tree/feat/rag) |
| [ ] | 第十二章 | [14-第十二章](./AI%20Agents%20开发实践/14-第十二章：MCP——工具调用的操作系统.md) | [feat/mcp](https://github.com/Cookieboty/autix-demo/tree/feat/mcp) |
| [ ] | 第十三章 | [15-第十三章](./AI%20Agents%20开发实践/15-第十三章：Skills——把最佳实践沉淀为能力资产.md) | [feat/skills](https://github.com/Cookieboty/autix-demo/tree/feat/skills) |
| [ ] | 第十四章 | [16-第十四章](./AI%20Agents%20开发实践/16-第十四章：DeepAgent——一个开箱即用的%20Agent%20Harness.md) | — |
| [ ] | 第十五章 | [17-第十五章](./AI%20Agents%20开发实践/17-第十五章：DeepAgent——长链任务与自主规划.md) | [feat/deepagents](https://github.com/Cookieboty/autix-demo/tree/feat/deepagents) |
| [ ] | 第十六章 | [18-第十六章](./AI%20Agents%20开发实践/18-第十六章：可观测性——你不能优化你看不见的东西.md) | [feat/observability](https://github.com/Cookieboty/autix-demo/tree/feat/ch16-observability) |
| [ ] | 第十七章 | [19-第十七章](./AI%20Agents%20开发实践/19-第十七章：评估流水线——给%20Agent%20装质检线.md) | [feat/eval](https://github.com/Cookieboty/autix-demo/tree/feat/ch17-eval) |
| [ ] | 第十八章 | [20-第十八章](./AI%20Agents%20开发实践/20-第十八章：安全、沙箱与权限隔离.md) | [feat/security](https://github.com/Cookieboty/autix-demo/tree/feat/ch18-security) |
| [ ] | 第十九章 | [21-第十九章](./AI%20Agents%20开发实践/21-第十九章：工程化交付——AI%20应用的%20CI／CD.md) | [feat/cicd](https://github.com/Cookieboty/autix-demo/tree/feat/ch19-cicd) |
| [ ] | 第二十章 | [22-第二十章](./AI%20Agents%20开发实践/22-第二十章：满血版%20MVP：端到端生产链路.md) | [feat/full-pipeline](https://github.com/Cookieboty/autix-demo/tree/feat/ch20-full-pipeline) |
| [ ] | 终章 | [23-终章](./AI%20Agents%20开发实践/23-终章：复盘与前瞻.md) | — |
| [ ] | 面试篇 | [24-面试篇](./AI%20Agents%20开发实践/24-面试篇：Agent%20基础与编排.md) | — |

## 每章节奏

1. 打开对应课本，读完「验收点 / 演进路线」。
2. 在本仓按步骤或章内 Prompt 实现（卡住时对照官方分支，不要整仓覆盖本仓）。
3. 用章内命令、URL 或测试完成验收。
4. 回到本文勾选进度，更新「当前下一步」。

## 环境预期（从第二章起）

书中工程底座大致依赖：

- Bun（workspaces / 脚本）
- Turbo（任务编排）
- Next.js（`clients/`）
- NestJS（`services/`）
- Docker Compose（多服务联调）
- TypeScript monorepo 共享包（`packages/contracts` 等）

具体版本与目录以第二章正文为准；本仓在完成第二章前可以没有任何应用代码。
