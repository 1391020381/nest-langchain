# LangGraph 学习服务

**本仓分支：** `feat/LangChain-LangGraph`（与 `feat/LangChain-Advanced-UI` 分离；官方对照 [autix-demo feat/LangGraph](https://github.com/Cookieboty/autix-demo/tree/feat/LangGraph)）。

这个 workspace 把第八章和第九章的知识点收敛成一个可以独立运行、独立测试的示例，不侵入现有 `api` 和 `chat` 服务。

## 覆盖的知识点

- `Annotation.Root`、State 默认值与 reducer
- Node、普通 Edge、Conditional Edge、`START` / `END`
- Triage：`chat / query / analyze` 三路分流和失败降级
- ReAct：专家内部 `agent -> tools -> agent` 回边与工具轮次硬上限
- Subgraph as Node：每个专家都是独立 ReAct 子图
- Supervisor：结构化选择功能、性能、安全、合规专家
- Fan-out / Fan-in：条件边返回数组，并发执行专家后在 Aggregator 汇合
- 并发 State 隔离：专家使用局部消息 State，主图使用独立结果字段
- Critic-Refine：`actor -> critic -> refine -> critic` 质量闭环
- 节点级错误降级：单个专家失败时保留部分报告
- `streamMode: "updates"` 节点级流式输出
- `MemorySaver`、`thread_id`、`interruptBefore`、`updateState`、断点恢复

## 图结构

```text
START -> triage
  ├─ chat  -> chatHandler  -> END
  ├─ query -> queryHandler -> END
  └─ analyze -> supervisor
                 ├─ functionalExpert  ─┐
                 ├─ performanceExpert ─┤
                 ├─ securityExpert    ─┼-> aggregator
                 └─ complianceExpert  ─┘
                                           -> actor -> critic
                                                        ├─ pass -> END
                                                        └─ refine -> critic
```

每个专家节点内部又是一张图：

```text
START -> agent
           ├─ tool_calls -> tools -> agent
           └─ no tool_calls -> END
```

## 目录说明

```text
src/state.ts              State、类型和 reducer
src/tools.ts              可直接替换成真实 API 的 Mock 工具
src/expert.graph.ts       通用 ReAct 专家子图工厂
src/nodes.ts              Triage、Supervisor、专家、聚合、质量节点
src/requirement.graph.ts  主图拓扑与路由函数
src/model.ts              读取环境变量创建 ChatModel
src/main.ts               普通调用和流式调用入口
src/hitl-demo.ts          Checkpointer + HITL 暂停恢复示例
test/*.spec.ts            不使用 API Key 的确定性图测试
```

`requirement.graph.ts` 将图拓扑和真实模型节点分开：生产入口调用 `createRequirementGraph(model)`；测试调用 `buildRequirementGraph(mockNodes)`。这样不需要 API Key 也能验证路径、并发、回边和持久化行为。

## 运行

在仓库根目录安装 workspace 依赖：

```bash
bun install
```

复制环境变量并填入模型配置：

```bash
cp services/langGraph/.env.example services/langGraph/.env
```

普通调用：

```bash
bun --cwd services/langGraph demo
```

自定义输入：

```bash
bun --cwd services/langGraph demo "分析 REQ-002：批量导入一万名用户"
```

节点级流式输出：

```bash
bun --cwd services/langGraph demo:stream
```

HITL 暂停、人工补丁与恢复：

```bash
bun --cwd services/langGraph demo:hitl
```

无需 API Key 的测试：

```bash
bun --cwd services/langGraph test
bun --cwd services/langGraph typecheck
```

## 生产化替换点

1. 将 `tools.ts` 的 Mock 数据替换成数据库、HTTP API 或 Retriever。
2. 将 `MemorySaver` 换成 `PostgresSaver`，并按用户和会话规范化 `thread_id`。
3. 给外部副作用工具增加幂等键，防止断点恢复时重复提交。
4. 使用 `streamEvents({ version: "v2" })` 把 token、工具和专家事件映射成 SSE。
5. 业务会话消息继续进入业务数据库；Checkpointer 只保存图的执行快照。
