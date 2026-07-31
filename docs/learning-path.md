# LangChain.js 实践路线

本项目假设你已经熟悉 NestJS。每一阶段先阅读对应代码，再修改实验变量并记录结果。

## 第 1 阶段：Models 与 Messages

- 阅读 `src/langchain/model.factory.ts`。
- 比较 `invoke`、`stream` 和 `batch`。
- 切换两个 OpenAI 兼容模型，比较延迟、Token 和结构化输出稳定性。
- 给每次调用添加 `tags` 与 `metadata`，在 LangSmith 中定位 Trace。

完成标准：能够解释 Message、Model、Runnable 和 Output Parser 的职责。

## 第 2 阶段：Runnable 与结构化输出

- 阅读 `src/langchain/langchain.service.ts`。
- 把并行任务从“摘要 + 关键词”扩展为“摘要 + 分类 + 风险提取”。
- 修改工单 Zod Schema，增加 SLA 和建议处理人。
- 为解析失败增加降级与重试。

完成标准：可以用 Runnable 组合确定性 AI 流程，不依赖 Agent。

## 第 3 阶段：Tools

- 阅读 `src/tools/toolkit.service.ts`。
- 手动完成一次 Model → Tool Call → ToolMessage → Model 循环。
- 新增只读商品查询工具。
- 新增写操作工具，但必须实现确认令牌和幂等键。
- 尝试让模型越权读取 `user-2` 的订单，确认工具层拒绝。

完成标准：身份和权限由应用注入，永远不信任模型传入的安全上下文。

## 第 4 阶段：RAG

- 阅读 `src/knowledge/knowledge.service.ts`。
- 比较 chunkSize 为 400、800、1200 时的结果。
- 比较 Top-K 为 3、5、10 时的召回效果。
- 将 `MemoryVectorStore` 替换成 pgvector、Qdrant 或 Milvus。
- 添加 metadata filter、混合检索和 reranker。
- 建立至少 30 条固定评估问题。

完成标准：能够区分检索失败与生成失败，并通过指标证明优化有效。

## 第 5 阶段：Agent

- 阅读 `src/agents/agent.service.ts`。
- 观察 Agent 的消息列表和工具调用轨迹。
- 测试无须调用工具、一次工具调用、多次工具调用、工具失败四类情况。
- 增加最大步骤数、超时、重试和写操作审批。

完成标准：能够判断一个需求应该使用普通 Chain 还是 Agent。

## 第 6 阶段：LangGraph

- 阅读 `src/graphs/graph.service.ts`。
- 查看 `/api/graphs/support-router/mermaid` 输出。
- 增加“核验订单 → 检索规则 → 风险判断 → 人工审批 → 执行退款”节点。
- 使用 `interrupt()` 实现人工审批。
- 将 `MemorySaver` 替换为 PostgreSQL Checkpointer。
- 验证服务重启恢复和写操作幂等。

完成标准：能够实现可暂停、可恢复、可审计的业务工作流。

## 第 7 阶段：评估与生产化

- 开启 LangSmith Trace。
- 固化 RAG、工具调用和安全攻击三类数据集。
- 记录正确率、引用正确率、工具选择正确率、延迟和成本。
- 加入限流、缓存、审计日志、敏感信息脱敏和 Prompt Injection 测试。
- 将文档解析和批量 Embedding 移到 BullMQ。

完成标准：模型或 Prompt 升级后，可以用自动化评估回答“是否真的更好”。
