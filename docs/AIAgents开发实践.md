# AI Agents 开发实践：学习 Path 与章后理解检查

本文是《AI Agents 开发实践》的可执行学习路径。教材正文位于 [`docs/AI Agents 开发实践/`](./AI%20Agents%20开发实践/)，章节总索引位于 [`learning-path.md`](./learning-path.md)。

本 Path 不以“读完”作为完成标准。每章必须经历：

```text
阅读概念
  → 完成章节实践
  → 用运行结果、测试或 Trace 验证
  → 回答章后理解问题
  → 通过后再标记完成
```

历史学习进度不自动继承到本文。只有能解释机制、给出证据并处理失败路径，才算真正掌握。

## 一、统一完成标准

学习任何一章后，都应从以下五个角度解释本章系统：

1. **输入与输出**：这一层接收什么，返回什么，数据结构由谁约束？
2. **决策与执行**：下一步由模型、图路由、业务代码还是人工决定？
3. **状态与生命周期**：状态保存在哪里，什么时候创建、更新、暂停、恢复或销毁？
4. **边界与失败**：权限、成本、超时、重试、并发和副作用怎样控制？
5. **验证与证据**：用什么测试、日志、Trace、指标或页面证明功能真的发生？

### 理解等级

| 等级 | 表现 | 是否通过 |
| --- | --- | --- |
| L0 记忆 | 能复述名词，但不能解释调用链 | 否 |
| L1 解释 | 能解释概念和基本用途 | 否 |
| L2 追踪 | 能从输入追到输出，指出状态、决策者和失败点 | 是 |
| L3 修改 | 能安全修改、测试、定位问题并说明取舍 | 优秀 |

### AI 章后提问协议

当学习者说“第 X 章学完了”时，AI 应按以下方式考核：

1. 从对应章节题库逐题提问，一次只问一题，不提前给答案。
2. 优先要求结合当前仓库代码、测试、LangSmith Trace 或运行结果回答。
3. 如果回答只停留在定义，继续追问“输入是什么、状态在哪里、谁决定下一步、如何验证”。
4. 每题按“概念正确、调用链完整、工程边界、验证证据”评价。
5. 总分达到 80/100，且没有关键误解，才标记本章“问答通过”。
6. 未通过时给出具体薄弱点和补练任务，不直接给整套标准答案。

建议评分：概念 25 分、调用链 30 分、工程边界 25 分、验证证据 20 分。

## 二、路线全景

```text
阶段 A  模型与工程基础
  序章 → 第 1 章 → 第 2 章 → 第 2.5 章

阶段 B  LangChain 应用能力
  第 3 章 → 第 4 章 → 第 5 章 → 第 6 章

阶段 C  Agent 推理与 LangGraph
  第 7 章 → 第 8 章 → 第 9 章

阶段 D  成本、知识与能力资产
  第 10 章 → 第 11 章 → 第 12 章 → 第 13 章

阶段 E  DeepAgent Harness
  第 14 章 → 第 15 章

阶段 F  生产治理
  第 16 章 → 第 17 章 → 第 18 章 → 第 19 章

阶段 G  端到端收束
  第 20 章 → 终章 → 面试篇
```

## 三、阶段 A：模型与工程基础

### 序章：站在范式之变的十字路口

教材：[序章](<./AI Agents 开发实践/1-序章：站在范式之变的十字路口.md>)

进度：- [ ] 阅读　- [x] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Chatbot、Workflow 与 Agent 的区别；
- Prompt、Structured Output、Tool Calling、ReAct 的递进关系；
- RAG、MCP、Skills、Subagent 的职责边界；
- Tracing、Eval 和工程化为什么是上线前提；
- Agent 的能力来自模型与确定性软件系统的协作。

实践产物：画出一张自己的 Agent 能力分层图，并为每层标注输入、输出和责任主体。

当前产物：[阶段 A 实施记录与能力分层图](./ai-agents-practice/stage-a-model-engineering-foundation.md)

章后问题：

1. 普通 Chatbot、固定 Workflow 和 Agent 的关键区别分别是什么？
2. 为什么 Tool Calling 不能只由模型文本决定，应用还必须校验和执行？
3. RAG、MCP、Skills 分别解决“知识、连接、方法”中的哪个问题？
4. 为什么一个能够返回正确答案的 Demo 仍不能被称为生产系统？
5. 如果某任务完全确定、步骤固定，为什么可能不应该使用 Agent？

通过标准：能用一个具体业务请求解释从模型生成到工具执行、知识检索和质量验证的完整分层。

### 第一章：把模型变成能力

教材：[第一章](<./AI Agents 开发实践/2-第一章：把模型变成能力.md>)

进度：- [ ] 阅读　- [x] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Model Input、Model Output 与常用推理参数；
- System Prompt 与 User Prompt；
- 模型漂移和非确定性；
- Structured Output 与 Zod 校验；
- 将一次模型调用封装为可复用模块。

实践产物：一个有明确输入 Schema、输出 Schema、错误处理和测试的模型能力函数。

当前产物：[阶段 A 结构化模型能力](./ai-agents-practice/stage-a-model-engineering-foundation.md)

章后问题：

1. 一次模型调用真正接收了哪些信息，哪些内容不应该混入 Prompt？
2. Prompt 约束与程序校验有什么区别？为什么两者不能互相替代？
3. temperature、模型版本和上下文变化会怎样造成输出漂移？
4. Structured Output 解析失败时，系统应该重试、降级还是拒绝？依据是什么？
5. 怎样证明你封装的是可复用能力，而不是只能跑一次的脚本？

通过标准：能够解释模型调用的契约、非确定性来源，并用测试证明非法输出不会进入业务层。

### 第二章：搭建智能体的工程底座

教材：[第二章](<./AI Agents 开发实践/3-第二章：搭建智能体的工程底座.md>)

进度：- [ ] 阅读　- [x] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Bun Workspace、Turbo 与 Monorepo；
- Next.js、NestJS 和共享 contracts；
- 前后端最小 HTTP 链路；
- Docker Compose 与环境一致性；
- build、test、typecheck、dev 的任务边界。

实践产物：可一键启动的 Web + API，前后端通过共享 Schema 完成一次请求。

当前产物：[阶段 A Web + API 验收说明](./ai-agents-practice/stage-a-model-engineering-foundation.md)

章后问题：

1. Monorepo 给当前 Agent 项目带来了什么，代价是什么？
2. 前端、NestJS 服务和共享包分别应该负责什么？
3. 为什么跨网络数据不能只使用 TypeScript interface？
4. Turbo 与 Bun Workspace 各自解决什么问题？
5. 新开发者怎样证明在没有本地隐式依赖的情况下也能启动工程？

通过标准：能解释工作区依赖、服务边界和启动链路，并完成一次干净环境验收。

### 第 2.5 章：用 AI 接管工程化开发

教材：[第 2.5 章](<./AI Agents 开发实践/4-第2.5章：用 AI 接管工程化开发：从工程底座到能力链路.md>)

进度：- [ ] 阅读　- [x] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- 规格、计划、实施、验证的 AI 协作流程；
- Superpowers 与 UI/UX 工具的定位；
- RBAC 等高约束任务怎样交给 AI；
- AI 生成代码的审查边界；
- 模型成本与上下文控制。

实践产物：一份从需求规格到验收证据完整闭环的 AI 辅助开发记录。

当前产物：[阶段 A Spec → Plan → 实施 → 验证记录](./ai-agents-practice/stage-a-model-engineering-foundation.md)

章后问题：

1. 为什么应该先形成规格和验收标准，再让 AI 大规模生成代码？
2. 哪些决策可以交给 AI，哪些必须由工程负责人确认？
3. RBAC 为什么不能只通过 Prompt 约束？
4. 怎样避免 AI 在多轮修改中破坏已有功能或用户改动？
5. 如何判断 AI 带来的时间收益是否抵消了模型与审查成本？

通过标准：能够展示一次有规格、有实施记录、有测试证据、可回滚的 AI 协作任务。

## 四、阶段 B：LangChain 应用能力

### 第三章：LangChain 起手

教材：[第三章](<./AI Agents 开发实践/5-第三章：LangChain 起手——搭建第一条服务端能力链路.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Chat Model、Prompt Template、Runnable 与 Chain；
- Structured Output；
- Tool 定义、Schema 与 Tool Calling；
- Model → Tool → Model 循环；
- NestJS 中的能力收束与统一入口。

实践产物：一个包含模板化 Prompt、结构化输出和至少一个 Tool 的服务端能力链。

章后问题：

1. LangChain 相比直接调用模型 SDK 增加了哪些抽象？
2. Prompt Template、Runnable 和 Chain 分别承担什么职责？
3. Tool 的名称、description 和 Schema 分别影响模型什么行为？
4. `AIMessage.tool_calls`、Tool 执行和 `ToolMessage` 的顺序是什么？
5. Agent 为什么继续调用模型，什么时候停止？请用 Trace 说明。

通过标准：能从一次 Trace 中解释所有 Message 的产生者、工具参数来源和循环停止条件。

### 第四章：Memory、Tools、Embedding 与多 Agent

教材：[第四章](<./AI Agents 开发实践/6-第四章：LangChain 进阶——记忆、工具与多 Agent.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- `RunnableWithMessageHistory` 与多轮上下文；
- 业务 Tool、文件 Tool 和权限边界；
- Embedding、向量存储与语义检索；
- Fixed Workflow、Router、Supervisor、Handoff、Planner-Executor；
- 多能力统一服务入口。

实践产物：一个能保持会话、调用确定性工具、进行语义检索并协调多个角色的接口。

章后问题：

1. Message History、Checkpointer 和长期 Memory 有什么区别？
2. Tool 为什么应该承载确定性计算，而不是把所有规则写入 Prompt？
3. 语义检索为什么能找到关键词不同但含义接近的内容？
4. 什么情况下应该拆成多个 Agent，什么情况下一个 Tool 就够了？
5. Fixed Workflow、Supervisor 和 Handoff 的控制权分别在哪里？

通过标准：能解释会话状态、工具权限、向量检索和多 Agent 编排的边界，并给出适用场景。

### 第五章：从 Mock 到生产

教材：[第五章](<./AI Agents 开发实践/7-第五章：从 Mock 到生产——数据库设计与向量化落库.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Prisma/PostgreSQL 数据模型；
- 会话与消息持久化；
- 用户和租户隔离；
- 文件上传、解析、Chunking、Embedding、pgvector；
- 异步处理与 SSE 通知。

实践产物：服务重启后仍可恢复历史，文档可上传、分块、向量化并按用户隔离检索。

章后问题：

1. 业务消息、文档、分块和向量为什么应该是不同的数据实体？
2. 从内存历史迁移到数据库后，调用链中哪些内容改变、哪些不变？
3. Chunk 大小和 overlap 会怎样影响召回率、成本和答案质量？
4. 为什么用户隔离必须在 SQL/Tool 层强制执行，而不能只写在 Prompt 中？
5. 为什么文档处理适合 SSE？处理失败后客户端和数据库分别应看到什么？

通过标准：能画出上传到检索的完整数据流，并通过重启、越权和失败测试证明系统边界。

### 第六章：让 AI 做更懂你的交互

教材：[第六章](<./AI Agents 开发实践/8-第六章：让 AI 做更懂你的交互.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Generative UI 与纯文本交互的差异；
- UI Response Protocol；
- Structured Output + Zod；
- Selection、Form、Confirmation、Steps、Card；
- 前端 Component Renderer 与交互状态机；
- Streaming、组件版本和未知组件 Fallback。

实践产物：完成“选择 → 表单 → 确认 → 执行 → 结果”的结构化交互闭环。

章后问题：

1. 为什么不能让模型直接输出任意 HTML/React 代码？
2. UI 协议为什么需要运行时 Schema，而不只是 TypeScript 类型？
3. 模型负责选择组件还是前端负责？双方边界是什么？
4. 页面刷新或重复提交时，交互状态机怎样保持一致？
5. Streaming 文本和结构化组件怎样避免顺序混乱或半成品渲染？

通过标准：能够证明模型输出无法绕过协议，未知组件安全降级，完整交互状态可追踪。

## 五、阶段 C：Agent 推理与 LangGraph

### 第七章：Agent 推理的三层决策机制

教材：[第七章](<./AI Agents 开发实践/9-第七章：Agent 推理的三层决策机制：路由、执行与优化.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Routing：选择路径；
- ReAct：局部观察与行动；
- Plan-and-Execute：全局规划与执行；
- Reflexion、Critic-Refine、Self-Consistency；
- 三层模式组合及成本取舍。

实践产物：为一个业务任务设计路由层、执行层和优化层，并说明每层的停止条件。

章后问题：

1. Routing、执行和优化三层分别回答什么问题？
2. ReAct 与 Plan-and-Execute 的决策粒度有什么不同？
3. Critic-Refine 与 Reflexion 为什么不是同一种重试？
4. 怎样防止推理循环永不结束或成本失控？
5. 为一个真实任务选择推理模式，并解释为什么不选择其他模式。

通过标准：能够根据任务复杂度、风险、成本和可验证性选择组合模式，而不是机械套用 ReAct。

### 第八章：LangGraph 单 Agent 图

教材：[第八章](<./AI Agents 开发实践/10-第八章：LangGraph 单 Agent 图实战——路由、循环与质量闭环.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- State、Node、Edge、Conditional Edge、Reducer；
- Loop 与 Subgraph；
- 从 Chain 迁移到 StateGraph；
- ReAct 与 Critic-Refine 子图；
- Checkpointer、`thread_id`、HITL、Streaming。

实践产物：一个包含路由、循环、质量修订、持久化或人工中断的 StateGraph。

章后问题：

1. State、Node 与普通函数调用的差异是什么？
2. 条件边由谁返回路由结果，非法路由应该怎样处理？
3. 并行节点为什么需要 Reducer，错误的 Reducer 会造成什么问题？
4. `interrupt()`、Checkpointer、`thread_id` 和 `Command({ resume })` 怎样协作？
5. 为什么 `interrupt()` 前的副作用可能重复，怎样设计幂等边界？

通过标准：能从图状态解释每次路由、循环、暂停和恢复，并测试重复恢复不会重复副作用。

### 第九章：LangGraph Multi-Agent

教材：[第九章](<./AI Agents 开发实践/11-第九章：LangGraph Multi-Agent 实战.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Supervisor + 专家集群；
- 并行分发与状态合并；
- Handoff；
- Plan-and-Execute + Supervisor + Reflexion；
- 节点级失败、超时、降级、Checkpointer 和 HITL。

实践产物：一个至少包含两位并行专家、状态合并和部分失败处理的多 Agent 图。

章后问题：

1. 为什么要拆 Agent，而不是给一个 Agent 更多 Prompt 和工具？
2. Supervisor 与 Handoff 的控制权和通信方式有什么差异？
3. 多个专家并行写 State 时如何避免覆盖和竞态？
4. 一个专家失败时，系统应该整体失败、重试还是带降级结果继续？
5. 怎样证明专家确实被调用，而不是协调者伪造了专家结论？

通过标准：能从 Trace 和 State 证明委派、并行、合并与降级真实发生，并说明拆分带来的成本。

## 六、阶段 D：成本、知识与能力资产

### 第十章：Token 经济学

教材：[第十章](<./AI Agents 开发实践/12-第十章：Token 经济学：在 AI 能力与运行成本之间寻找平衡.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Agent 的 Token 成本结构；
- Prompt/Tool Schema 瘦身；
- 消息裁剪与摘要；
- Prompt Caching；
- 模型分级；
- 节点级 usage、预算阈值和降级。

实践产物：一份按 run、node、model 记录 Token、延迟和估算成本的报表，以及至少一条预算保护规则。

章后问题：

1. Multi-Agent 和长上下文为什么会非线性增加成本？
2. 裁剪、摘要和 VFS 外移分别适合处理什么内容？
3. Prompt Cache 需要怎样的稳定前缀，哪些变化会让缓存失效？
4. 哪些节点可以降级到便宜模型，怎样验证质量没有明显下降？
5. 超预算时系统应该停止、降级还是继续？决策依据是什么？

通过标准：能定位一次运行的主要成本来源，并用数据证明优化前后的质量和成本变化。

### 第十一章：RAG

教材：[第十一章](<./AI Agents 开发实践/13-第十一章：RAG——让AI更懂你的业务.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- RAG 与微调、长上下文的区别；
- Embedding、Chunking、向量库和 Top-K；
- Query Rewrite、Hybrid Search、Metadata Filter、Rerank；
- Recall@K、Precision@K、MRR、NDCG、Faithfulness、RAGAS；
- HyDE、Self-RAG、CRAG、Adaptive-RAG、Graph-RAG；
- RAG-as-Tool 接入 Agent。

实践产物：可评估的 baseline RAG，包含数据集、来源引用、检索指标和至少一项可量化优化。

章后问题：

1. 什么情况下使用 RAG，而不是微调或直接塞入长上下文？
2. Chunk 策略、Embedding 和索引分别影响检索链路的哪一部分？
3. Recall@K、MRR、NDCG 与 Faithfulness 分别测量什么？
4. 检索效果差时，为什么应该先定位召回、排序还是生成问题？
5. 为什么多数系统应先优化 baseline，而不是直接使用 Graph-RAG？

通过标准：能用固定数据集区分检索错误和生成错误，并用指标证明优化有效。

### 第十二章：MCP

教材：[第十二章](<./AI Agents 开发实践/14-第十二章：MCP——工具调用的操作系统.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Function Calling 的局限；
- MCP Server、Client、Tool、Resource、Prompt；
- stdio 与远程传输；
- 多 Server 编排；
- 生命周期、错误韧性、安全、测试和可观测性；
- RAG-as-MCP-Server。

实践产物：一个可由独立 MCP Client 发现并调用的 Server，并具备参数校验、错误处理和权限边界。

章后问题：

1. MCP 相比应用内 LangChain Tool 多解决了什么问题？
2. Tool、Resource 和 Prompt 三种 MCP 原语各适合什么数据或能力？
3. stdio 与远程传输在生命周期、权限和部署上有什么差异？
4. 多个 MCP Server 同名工具、超时或部分不可用时如何处理？
5. 为什么 MCP 只是连接协议，不能自动提供认证、授权和安全？

通过标准：能从 Client 发现能力到 Server 执行画出完整协议链，并验证失败和越权路径。

### 第十三章：Skills

教材：[第十三章](<./AI Agents 开发实践/15-第十三章：Skills——把最佳实践沉淀为能力资产.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- RAG、MCP、Agent、Skill 的边界；
- Agent Skills 规范和 `SKILL.md`；
- LangChain Custom Skills Pattern；
- DeepAgent Skills；
- Claude Code Skills；
- Skill 的发现、加载、版本与测试。

实践产物：一个包含适用场景、步骤、约束、资源和验收标准的可复用 Skill。

章后问题：

1. Skill 与普通 System Prompt、RAG 文档和 Tool description 有什么区别？
2. 什么知识应该放 Skill，什么内容应该放 Tool 或 RAG？
3. Agent 如何发现并按需加载 Skill，为什么不应把所有 Skill 全塞入上下文？
4. 自定义 Subagent 是否自动继承父 Agent 的 Skill？如何验证？
5. Skill 修改后怎样做版本管理、回归测试和质量验收？

通过标准：能设计一个不会与 Tool/RAG 职责重叠的 Skill，并证明 Agent 在合适场景加载并遵循它。

## 七、阶段 E：DeepAgent Harness

### 第十四章：DeepAgent Harness

教材：[第十四章](<./AI Agents 开发实践/16-第十四章：DeepAgent——一个开箱即用的 Agent Harness.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Agent Harness 的定位；
- `createDeepAgent()`；
- 默认 Prompt 与 Agent loop；
- `write_todos`；
- 虚拟文件系统；
- `task` 与 Subagent；
- Skills 接入及 Harness 的取舍。

实践产物：一个使用 Todo、VFS、Subagent 和 Skill 完成长任务的 DeepAgent，并有 Trace 证据。

章后问题：

1. `createDeepAgent()` 替你组装了哪些原本需要手写的能力？
2. “工具已暴露”和“工具已调用”怎样在 Trace 中区分？
3. Todo 为什么不会因为 Subagent 返回结果就自动完成？
4. VFS 解决什么问题，它是否等于宿主机文件或长期记忆？
5. 什么任务不适合 DeepAgent，应该改用普通 Tool、Chain 或 StateGraph？

通过标准：能从一次 Trace 解释 Prompt、Todo、文件和 Subagent 的真实调用链，并明确默认能力与显式配置的区别。

### 第十五章：DeepAgent 长链任务与自主规划

教材：[第十五章](<./AI Agents 开发实践/17-第十五章：DeepAgent——长链任务与自主规划.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- DeepAgent Middleware 装配；
- CompiledSubAgent 与旧 LangGraph 迁移；
- Todo 深层机制；
- Summarization、VFS、Token Eviction；
- Backend、Checkpointer、Store 与三层持久化；
- Memory、HITL、异步 Subagent 和模型 Profile。

实践产物：一个能够说明上下文压缩、状态保存、长期记忆、人工审批和 Subagent 生命周期的长任务示例。

章后问题：

1. 什么特征使任务成为长链任务，而不仅是“调用次数多”？
2. Summarization、VFS 和 Token Eviction 各自处理哪类上下文压力？
3. Backend、Checkpointer、Store 和 Memory 分别保存什么？
4. `interruptOn` 如何与 Checkpointer、`thread_id`、`Command({ resume })` 协作？
5. 普通 Subagent、CompiledSubAgent 和异步 Subagent 的适用场景有什么不同？
6. 服务重启后能否恢复任务？请根据当前具体配置回答，而不是根据框架能力猜测。

通过标准：能准确指出每类状态的保存位置和生命周期，并实际验证暂停恢复、跨线程记忆或长上下文处理中的至少两项。

## 八、阶段 F：生产治理

### 第十六章：可观测性

教材：[第十六章](<./AI Agents 开发实践/18-第十六章：可观测性——你不能优化你看不见的东西.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Logs、Metrics、Traces 的区别；
- Pino 结构化日志；
- traceId 与 Span；
- LangChain callbacks 与模型调用观测；
- Token/成本 Metrics、健康检查；
- LangGraph Studio 与 LangSmith。

实践产物：一次请求可以通过同一个 traceId 关联 HTTP、Agent、Model、Tool、Token 和错误信息。

章后问题：

1. 日志、指标和 Trace 分别适合回答什么问题？
2. traceId 怎样从入口传播到模型、工具和 Subagent？
3. 怎样记录模型输入输出而不泄露密钥和敏感业务数据？
4. 哪些 Token、延迟、错误和工具指标应该成为告警条件？
5. LangSmith Trace 与应用业务日志为什么不能互相替代？

通过标准：能从一个失败请求定位到具体节点和原因，并证明敏感信息没有进入日志或 Trace。

### 第十七章：评估流水线

教材：[第十七章](<./AI Agents 开发实践/19-第十七章：评估流水线——给 Agent 装质检线.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- 检索、生成与 Agent 流程三层评估；
- Recall、MRR、NDCG；
- Faithfulness 与 RAGAS；
- LLM-as-Judge；
- Golden Dataset、Rubric、Eval Runner；
- 阈值门禁与 LangSmith 托管评测。

实践产物：一套固定数据集、评分规约、基线结果和可阻止质量退化的评估命令。

章后问题：

1. 为什么单元测试通过仍不能证明 Agent 质量合格？
2. 检索、生成和流程评估各自需要什么样的样本与指标？
3. LLM-as-Judge 有哪些偏差，如何校准和减少自我评价偏差？
4. Golden Dataset 怎样防止只覆盖正常路径或过拟合当前 Prompt？
5. 哪些 Eval 应进入每次 PR，哪些适合 nightly 或发布前运行？

通过标准：能通过修改 Prompt 或模型制造一次质量退化，并让评估门禁稳定检测出来。

### 第十八章：安全、沙箱与权限隔离

教材：[第十八章](<./AI Agents 开发实践/20-第十八章：安全、沙箱与权限隔离.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- 威胁建模、Trust Boundary、Security Invariant、Fail Closed；
- Prompt Injection 与不可信内容；
- 多 Agent 信任扩散；
- 认证、沙箱、工具权限、Capability Delegation；
- Risk-based HITL；
- 数据流、密钥、Kill Switch、Action Log 和审计。

实践产物：一份威胁模型以及通过测试验证的工具白名单、租户隔离、审批和审计链路。

章后问题：

1. Prompt Injection 为什么是信任边界问题，而不仅是 Prompt 写得不好？
2. Security Invariant 与普通权限规则有什么区别？
3. 为什么 Prompt 中的“不要访问其他用户数据”不是安全控制？
4. 哪些 Tool 必须进入沙箱或 HITL，风险等级如何确定？
5. 多 Agent 委派时怎样限制能力继续扩散？
6. 密钥怎样被工具使用但不暴露给模型、日志和返回值？

通过标准：能针对一个 Agent 行动链画出信任边界，并用攻击用例证明系统默认拒绝、权限收窄且可审计。

### 第十九章：AI 应用 CI/CD

教材：[第十九章](<./AI Agents 开发实践/21-第十九章：工程化交付——AI 应用的 CI／CD.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Turbo 测试流水线与 GitHub Actions；
- Monorepo-aware Docker 构建和 Compose；
- 数据库 Migration；
- Eval Gate；
- 蓝绿、金丝雀和回滚；
- Prompt、Model、Knowledge 三态版本；
- Availability、Latency、Eval Score、Cost SLO。

实践产物：一条包含静态检查、测试、构建、迁移检查、评估和发布门禁的 CI/CD 流水线。

章后问题：

1. AI 应用 CI/CD 比传统应用多了哪些不确定变量？
2. 为什么 Prompt、模型和知识库都必须有独立版本与回滚能力？
3. 哪些测试应该离线确定性执行，哪些需要真实 Provider？
4. 模型切换为什么应该被视为一次部署，而不是普通配置修改？
5. 怎样定义同时覆盖可用性、质量和成本的 SLO？

通过标准：能说明一次发布如何验证代码、Prompt、模型与知识版本，并演示质量不达标时阻止发布或回滚。

## 九、阶段 G：端到端收束

### 第二十章：满血版 MVP

教材：[第二十章](<./AI Agents 开发实践/22-第二十章：满血版 MVP：端到端生产链路.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Hybrid Search + Rerank；
- 检索内容进入最终报告；
- MCP、Skills、DeepAgent 长链协作；
- 对话历史与 SSE 领域协议；
- 认证、观测、评估、安全和成本横切能力；
- Layer 1/2/3 测试和上线闭环。

实践产物：一条从浏览器请求到最终报告、全程可追踪、可评估、可审计、可部署的生产链路。

章后问题：

1. 请从浏览器开始，逐步说明一次生产请求经过的所有系统和状态。
2. RAG、MCP、Skills、DeepAgent 在最终链路中分别承担什么职责？
3. 前端为什么只消费领域事件，而不应依赖 LangGraph 原始事件？
4. Layer 1、Layer 2、Layer 3 分别证明什么，不能证明什么？
5. 任意一个节点失败时，用户、数据库、Trace 和审计日志应分别看到什么？
6. 上线前如何同时判断功能、质量、安全、成本和恢复能力合格？

通过标准：能现场演示完整链路，并从一个 runId/threadId 找到输入、检索、工具、Agent、成本、评估和最终结果证据。

### 终章：复盘与前瞻

教材：[终章](<./AI Agents 开发实践/23-终章：复盘与前瞻.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Demo、MVP 与产品的差异；
- AI 产品交付的是受约束的确定性；
- 商业假设、模型成本与定价；
- 能力资产化与市场化；
- 工程边界、跨端一致性和长期维护。

实践产物：一份当前产品的能力边界、成本模型、风险清单和下一阶段路线图。

章后问题：

1. 当前 MVP 验证的商业假设是什么，哪些结论仍不能推出？
2. 产品向用户交付的是模型能力、答案，还是受约束的业务结果？
3. 模型、人工审核和基础设施成本怎样进入定价？
4. 哪些能力已经可以资产化，哪些仍是项目定制代码？
5. 如果模型供应商、终端平台或业务方向变化，哪些边界能保护系统？

通过标准：能将技术能力映射到用户价值、成本、风险和可持续经营，而不只描述功能列表。

### 面试篇：Agent 基础与编排

教材：[面试篇](<./AI Agents 开发实践/24-面试篇：Agent 基础与编排.md>)

进度：- [ ] 阅读　- [ ] 实践　- [ ] 问答　- [ ] 验收

核心知识：

- Agent、Chatbot 与 Workflow；
- ReAct、Plan-and-Execute、Reflexion；
- LangChain 与 LangGraph；
- State、Router、Multi-Agent；
- Supervisor、Handoff 等协作拓扑；
- Agent 框架选型。

实践产物：能够使用当前项目中的实际代码和 Trace 回答架构及故障场景问题。

章后问题：

1. 用当前项目举例说明 Agent 与固定 Workflow 的差异。
2. LangChain、LangGraph 和 DeepAgent 的抽象层级与职责是什么？
3. 为何 ReAct、Plan-and-Execute 和 Reflexion 不能简单互相替代？
4. Supervisor、Handoff、并行专家分别适合什么组织结构？
5. 给定一个高风险长任务，你会选择什么框架和运行时设计？为什么？
6. 描述一次你实际定位过的 Agent 问题：证据、根因、修复和回归测试是什么？

通过标准：回答不只包含定义，还能引用实际代码、状态、Trace、失败案例和架构取舍。

## 十、最终毕业检查

完成全部章节后，学习者应能不看文档回答：

1. 当前状态保存在哪里？
2. 下一步由谁决定？
3. 模型、应用代码、图路由和人工审批的边界是什么？
4. 为什么系统能够暂停和恢复？
5. 恢复或重试会不会重复执行副作用？
6. 知识、工具、方法和 Agent 分别由 RAG、MCP、Skills、DeepAgent 如何承载？
7. 如何证明某个 Tool、Subagent、Memory 或 HITL 能力真的发生，而不是只存在于 Prompt？
8. 如何测量答案质量、检索质量和 Agent 流程质量？
9. 如何限制 Token、延迟、权限和预算？
10. 如何对 Prompt、模型、知识库和代码进行版本管理与回滚？
11. 服务重启、扩容、并发和部分失败后，系统怎样保持一致？
12. 一次生产请求如何从 Web 贯穿 NestJS、DeepAgent/LangGraph、工具、数据、Trace、Eval 和审计？

毕业验收建议包含：

- 一次端到端现场演示；
- 一次故障注入与恢复；
- 一次越权或 Prompt Injection 防护测试；
- 一次质量回归被 Eval Gate 阻止；
- 一次成本对比与优化说明；
- 一份完整架构图和责任边界说明。

