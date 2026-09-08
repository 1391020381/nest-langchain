# DeepAgent API 知识点总结

本文基于当前仓库中的 `services/deepagent-api` 真实实现，归纳这个服务涉及的核心知识、代码职责、一次请求的运行过程，以及联调中暴露出的工程问题。

它不是 DeepAgent 通用 API 手册。阅读目标是回答三个问题：

1. 当前服务为什么这样分层？
2. `deepagent.runtime.ts` 实际负责什么？
3. 从演示型 Agent 走向生产系统，还缺少什么？

## 1. 服务定位

当前项目实现的是一个需求分析多 Agent：

- Root Agent：`requirement-coordinator`，负责任务规划、专家委派和最终汇总；
- 需求专家：`requirement-analyst`；
- 风险专家：`risk-reviewer`；
- 验收专家：`acceptance-designer`；
- 确定性工具：需求完整性分析、复杂度估算；
- Skill：需求分析规范、评分规则和报告模板；
- API：NestJS 提供 SSE 流式接口；
- Web：Next.js 实时展示 Agent、工具、Todo 和产物。

整体调用链：

```text
浏览器
  → Next.js 同源 /api 代理
  → NestJS AgentController
  → AgentService
  → DeepAgentRuntime
  → createDeepAgent 创建的 Root Agent
  → Tools / Skills / SubAgents / StateBackend
  → RuntimeEvent
  → 公共 SSE Event
  → 浏览器工作台
```

## 2. 核心知识地图

| 知识点 | 当前作用 | 主要代码 |
| --- | --- | --- |
| DeepAgent Harness | 提供 Agent 循环、Todo、文件工具和 SubAgent 委派 | `agent.factory.ts` |
| LangChain Model | 通过 `ChatOpenAI` 接入 OpenAI-compatible 模型 | `model.factory.ts` |
| Tool Calling | 让模型调用确定性函数和 DeepAgent 内置工具 | `tools/requirement.tools.ts` |
| Zod Schema | 校验工具参数、HTTP 请求和 SSE 事件 | `requirement.tools.ts`、`deepagent-contracts` |
| System Prompt | 定义 Root Agent 的目标、工作流和终止条件 | `prompts/coordinator.prompt.ts` |
| SubAgent | 隔离专家职责、上下文、工具和权限 | `subagents/requirement.subagents.ts` |
| Skills | 将稳定的方法和模板从长 Prompt 中分离 | `skills/requirement-analysis/**` |
| StateBackend | 提供单次运行内的虚拟文件系统 | `agent.factory.ts`、`skill-files.ts` |
| Filesystem Permission | 控制 Agent 能读取或写入的虚拟路径 | `agent.factory.ts`、`requirement.subagents.ts` |
| Middleware | 在模型与工具执行间增加程序化护栏 | `workflow-limits.middleware.ts` |
| LangGraph Events | 暴露 Chain、Tool 和 SubAgent 生命周期 | `deepagent.runtime.ts` |
| AsyncGenerator | 按发生顺序逐个输出运行事件 | `deepagent.runtime.ts`、`agent.service.ts` |
| SSE | 通过一个 HTTP 响应持续向浏览器推送事件 | `agent.controller.ts` |
| AbortSignal | 浏览器取消或断开后终止服务端运行 | `agent.controller.ts`、`deepagent.runtime.ts` |
| 领域协议 | 隔离前端与 DeepAgent 原始事件 | `packages/deepagent-contracts` |
| 可观测性 | 使用 `runId` 关联一次运行的全部日志 | `agent.service.ts` |

## 3. 为什么直接使用 DeepAgent

当前工程没有先手写一张业务 `StateGraph`，而是直接组装：

```ts
createDeepAgent({
  name: "requirement-coordinator",
  model,
  tools,
  subagents,
  systemPrompt,
  middleware,
  backend: new StateBackend(),
  skills: ["/skills/"],
  permissions,
});
```

DeepAgent 已经提供了通用 Harness 能力：

- `write_todos`：规划和更新任务；
- `task`：调用 SubAgent；
- `read_file`、`write_file`：在 Backend 中管理上下文和产物；
- Skills：按需读取方法资产；
- Middleware：介入模型和工具执行周期；
- LangGraph Runtime：负责循环、事件和状态流转。

项目代码需要补充的不是另一套 Agent 循环，而是业务角色、工具、权限、交付契约和运行时适配。

## 4. Root Agent、Prompt 和 Todo

`COORDINATOR_PROMPT` 是 Root Agent 的业务 System Prompt。DeepAgent 还会叠加 Todo、文件系统、Skills 和 SubAgent 等 Middleware 指令，所以它不是模型最终看到的唯一系统内容。

当前 Prompt 约束 Root Agent：

1. 使用 `write_todos` 建立计划；
2. 读取需求分析 Skill；
3. 并行调用三位指定专家，每位一次；
4. 确保三份专家产物写入固定路径；
5. 读取三份产物并生成最终报告；
6. 把全部 Todo 更新为 `completed`；
7. 写完最终报告后停止，不再自检或重新委派。

Todo 不会因为 `task` 成功而自动完成。模型必须显式调用 `write_todos` 更新状态，因为一个业务 Todo 可能同时包含委派、读取、汇总和写报告多个动作。

因此当前采用两层保证：

```text
Prompt 要求模型完成 Todo
        +
Runtime 拒绝 Todo 未完成的最终结果
```

## 5. Tool：把确定性计算从模型中移出

`requirement.tools.ts` 提供两个 `DynamicStructuredTool`：

### 5.1 `analyze_completeness`

按六个固定维度分析需求：

- 用户与场景；
- 目标与价值；
- 功能范围；
- 验收标准；
- 非功能要求；
- 边界与例外。

输出覆盖项、缺失项、澄清问题和 0–100 分。

### 5.2 `estimate_complexity`

根据文本长度和外部集成、批处理、安全、性能、AI 等因素，输出：

- `S/M/L/XL`；
- 估算天数区间；
- 复杂度因素。

这体现了 Agent 工程中的重要分工：

```text
Tool：可重复、可测试的确定性事实
LLM：理解语义、发现遗漏、做取舍并组织表达
```

如果把评分规则完全写进 Prompt，同一输入可能得到不同数字，也难以做稳定的离线测试。

## 6. SubAgent：职责隔离和最小权限

三位 SubAgent 的能力不同：

| SubAgent | 主要职责 | 能力边界 | 固定产物 |
| --- | --- | --- | --- |
| `requirement-analyst` | 完整性、范围、澄清问题、复杂度 | Skill + 两个确定性工具 | `/work/requirement-analysis.md` |
| `risk-reviewer` | 技术、数据、安全、交付与依赖风险 | 只依据需求独立审查 | `/work/risk-review.md` |
| `acceptance-designer` | Given-When-Then 验收与边界测试 | Skill + 文件工具 | `/work/acceptance-criteria.md` |

SubAgent 的主要价值不是增加三个角色名称，而是：

- 每位专家拥有独立 System Prompt；
- 只暴露完成其任务所需的工具；
- 长分析留在专家上下文，不全部挤入 Root Agent；
- 每位专家只能写自己的固定产物；
- 专家结论最后由 Root Agent 统一处理。

项目还关闭了 Harness 自动提供的 `general-purpose` SubAgent，防止 Root Agent 绕过三个具名专家和对应验收要求。

## 7. Skills：可渐进加载的方法资产

需求分析 Skill 在仓库中的真实位置是：

```text
services/deepagent-api/skills/requirement-analysis/
├── SKILL.md
├── references/scoring-rubric.md
└── assets/report-template.md
```

`skill-files.ts` 在每次运行开始前读取这些版本化文件，并转换成 StateBackend 路径：

```text
/skills/requirement-analysis/SKILL.md
/skills/requirement-analysis/references/scoring-rubric.md
/skills/requirement-analysis/assets/report-template.md
```

Skill 适合保存稳定的方法、清单和模板；Tool 适合确定性计算；Prompt 只保留角色、目标、步骤和边界。这样可以避免 System Prompt 无限增长。

## 8. StateBackend 和 `/work`

当前使用：

```ts
backend: new StateBackend()
```

它把文件保存在本次 Agent State 的 `files` 字段中。例如：

```ts
state.files["/work/final-report.md"] = {
  content: "# 最终报告...",
};
```

因此 `/work` 是虚拟路径，不对应：

```text
D:\github\AI-Agent\nest-langchain\work
```

权限配置只表示允许操作虚拟路径，也不会在 Windows 创建目录：

```ts
{ operations: ["read", "write"], paths: ["/work/**"] }
```

当前 Backend 的生命周期是单次运行：

- 同一次运行中，Root Agent 和 SubAgent 可以共享文件；
- 运行结束后，Runtime 会提取 `/work/**` 产物并发给前端；
- 新请求即使复用 `threadId`，也不会自动恢复旧文件；
- 服务重启后不会恢复；
- 当前还没有数据库、对象存储或持久化 Checkpointer。

生产环境通常将 `/work` 保留为沙箱草稿区，再把最终产物上传到 S3、OSS、COS 或 MinIO，并在数据库中保存 `runId`、逻辑路径和存储 Key。

## 9. 文件权限模型

Root Agent 权限：

```text
读取 /                 用于发现 /skills 和 /work
读取 /skills/**        Skill 只读
读写 /work/**          临时产物
拒绝其他 /**           默认拒绝
```

SubAgent 权限更加严格。每位专家只能写自己的目标文件：

```ts
{ operations: ["write"], paths: [artifactPath] }
```

仅靠 Prompt 说“请写这个文件”不构成安全边界。生产系统应同时使用：

```text
Prompt 约束
+ Tool allowlist
+ Backend permission
+ 运行时校验
```

## 10. `deepagent.runtime.ts` 的准确职责

`deepagent.runtime.ts` 是 DeepAgent 与应用之间的运行时适配层，主要负责：

1. 创建并启动 Root Agent；
2. 加载 Skill 文件并构造初始 State；
3. 消费 DeepAgent/LangGraph 原始事件；
4. 识别 Root Agent、SubAgent 和工具生命周期；
5. 把底层事件转换为应用 `RuntimeEvent`；
6. Root Agent 结束时获取最终 State；
7. 校验专家、Todo 和四份产物；
8. 输出 `progress`、`artifact` 和 `final`。

它并不定义全部需求分析业务。职责分布是：

| 文件 | 负责内容 |
| --- | --- |
| `coordinator.prompt.ts` | Root Agent 工作流和交付要求 |
| `requirement.subagents.ts` | 专家角色、工具、路径和权限 |
| `requirement.tools.ts` | 确定性分析逻辑 |
| `agent.factory.ts` | 组装 Model、Tools、Skills、SubAgents、Backend、Middleware |
| `deepagent.runtime.ts` | 启动、观察、转换和最终校验 |

### 10.1 启动 Root Agent

Runtime 调用：

```ts
const agent = createRequirementAgent(model);
const files = await loadRequirementSkillFiles();

const initialState = {
  messages: [{ role: "user", content: input }],
  files,
};
```

再通过 `streamEvents` 启动：

```ts
agent.streamEvents(initialState, {
  version: "v2",
  recursionLimit,
  configurable: { runId, threadId },
  signal,
});
```

### 10.2 获取 Root Agent 最终结果

Runtime 先根据 Root Agent 名称记录它的 `run_id`：

```ts
if (event.name === ROOT_AGENT_NAME && !rootRunId) {
  rootRunId = event.run_id;
}
```

然后在对应的 `on_chain_end` 中保存最终 State：

```ts
if (event.run_id === rootRunId) {
  finalState = event.data?.output;
}
```

这里的 `finalState` 才是完整 Root Agent 输出，可能包含：

```text
messages
todos
files
```

### 10.3 中间过程拿到的是事件，不是完整 State 快照

当前 Runtime 主要监听：

```text
on_chain_start
on_chain_end
on_chain_error
on_tool_start
on_tool_end
on_tool_error
```

它根据这些事件重建前端执行轨迹：

- 哪位专家开始或完成；
- 哪个 Agent 调用了什么工具；
- 工具成功还是失败。

所以更准确的表述是：

> Runtime 监听中间生命周期事件，并在 Root Agent 完成时取得完整最终 State；它没有在每一步向前端发送完整的 `messages/files/todos` 状态快照。

### 10.4 Namespace 与事件归属

多个 SubAgent 并行执行时，原始 Tool Event 不一定直接携带前端需要的专家名称。Runtime 使用 `langgraph_checkpoint_ns` 建立 namespace 到 Agent 的映射，再使用：

```text
activeSubagents
activeTools
namespaceOwners
```

判断某个 `read_file`、`write_file` 或业务工具属于 Root Agent 还是某位专家。

这些 Map 是展示投影，不是业务持久化 State。

### 10.5 最终硬校验

Prompt 表示模型应该完成什么，不代表它一定完成。`projectResult` 在发送 `final` 前校验：

- 三位指定专家都成功结束；
- 四份 `/work` 产物存在且非空；
- Todo 列表存在；
- 每个 Todo 都是 `completed`；
- 最终报告取自 `/work/final-report.md`，而不是任意最后一条模型消息。

这一步把概率性的模型输出转换成应用可以信任的确定性交付契约。

## 11. `async *`、`yield` 和 `for await`

Runtime 与 Service 都使用异步生成器：

```ts
async *stream(...): AsyncGenerator<RuntimeEvent> {
  yield startedEvent;

  for await (const event of events) {
    yield mapEvent(event);
  }

  yield finalEvent;
}
```

含义分别是：

- `async`：函数内部可以 `await`；
- `*`：函数可以分多次产生结果；
- `yield`：立即交出一个事件，但函数不会结束；
- `for await`：等待异步事件流中的下一项。

普通 `async/await` 最适合“一次等待、一次返回”：

```ts
const result = await agent.invoke(...);
return result;
```

但当前 UI 需要在最终结果产生前持续看到进度，所以需要 `AsyncGenerator`。它仍然使用 `await`，只是返回模型从“一次性 Promise”变成“异步事件序列”。

## 12. 为什么使用 v2 Raw Events

当前锁定的 `deepagents 1.10.2 + langchain 1.5.4` 组合中，v3 的重复 SubAgent transformer 在失败路径可能留下应用无法消费的 rejected Promise。

因此 Runtime 使用：

```ts
version: "v2"
```

并在一个 `for await` 循环里统一处理原始事件。这样需要自行完成事件归属和领域映射，但失败清理路径更可控。

这不是“v3 永远不可用”，而是针对当前依赖组合做出的版本兼容选择。升级依赖后，应重新执行真实 SubAgent 失败测试，再决定是否切换。

## 13. Middleware、循环保护与并行状态

LLM 可能重复委派、回读文件或继续自检，不能只依赖 Prompt 正常停止。当前有限流程采用三层保护：

```text
Root task 最多 3 次
每位专家全部工具最多 8 次
每位专家 write_file 最多 1 次
```

系统还保留：

```text
recursionLimit = 80
```

两者作用不同：

- 业务工具上限：约束某种具体行为；
- `recursionLimit`：整个 LangGraph 长时间不结束时的最终熔断。

### 13.1 为什么没有直接使用有状态 ToolCallLimit Middleware

联调中曾使用通过 State 保存 `threadToolCallCount` 的限流方式。三个专家并行结束时，同时向同一个 `LastValue` channel 写入不同计数，触发：

```text
InvalidUpdateError
LastValue can only receive one value per step
```

当前 `workflow-limits.middleware.ts` 改为从历史 `ToolMessage` 计算次数，不声明新的 State channel。它保留并行 SubAgent，同时避免共享计数的并发写入冲突。

这里体现了 LangGraph 的并行更新原则：

> 同一个 step 有多个节点写同一个 State key 时，该 key 必须有能够合并多个值的 reducer；否则应避免让并行分支写这个 key。

## 14. `recursionLimit` 不是工具调用次数

一次 LangGraph step 可能是：

- 一次模型调用；
- 一次工具节点执行；
- 一次 Middleware hook；
- SubAgent 子图中的一步；
- 子图回到父图的一次状态合并。

因此 `recursionLimit: 80` 不等于允许调用 80 次工具。它只是限制图最多运行多少个内部步骤。

生产系统通常同时设置：

- 具体工具调用上限；
- 最大图步骤；
- 最大运行时长；
- 最大 Token 或费用预算；
- 浏览器取消和服务端超时。

## 15. AgentService：应用信封、日志和错误边界

`AgentService` 包装 Runtime，而不参与 Agent 的业务推理：

1. 创建 `runId`；
2. 接收或创建 `threadId`；
3. 为每个事件补充 ISO 时间戳；
4. 使用共享 Zod Schema 校验公开事件；
5. 按 `runId` 打印 Agent、工具、产物和最终统计；
6. 把内部异常转换为有限的公开错误；
7. 正常可收口时发送 `done`。

公共事件顺序：

```text
成功：run.started → progress* → artifact* → final → done
失败：run.started → progress* → error → done
取消：run.started → progress* → HTTP 连接关闭
```

服务端日志保留完整异常栈；前端只收到经过筛选的错误信息，避免泄漏凭据、内部路径或 Provider 响应。

## 16. NestJS SSE 和取消传播

`AgentController` 的 `POST /api/agent/runs/stream`：

- 用 `AgentRunRequestSchema.safeParse` 校验请求；
- 设置 `text/event-stream`；
- 设置 `no-cache` 和 `X-Accel-Buffering: no`；
- 使用 `for await` 消费 Service 事件；
- 调用 `response.write()` 逐条发送 SSE；
- 监听请求中断和响应关闭；
- 通过 `AbortController` 把取消传播到 DeepAgent。

SSE 适合当前“客户端发起一次任务，服务器单向推送进度”的场景。它比 WebSocket 简单，但不适合需要高频双向交互的协议。

## 17. 共享协议和运行时校验

`packages/deepagent-contracts` 使用 Zod 定义：

```text
AgentRunRequest
run.started
progress
artifact
final
error
done
```

只写 TypeScript interface 不能校验网络输入。当前协议分别在三个边界执行运行时校验：

- Controller 校验浏览器请求；
- Service 校验 Runtime 映射后的公开事件；
- Web 校验 SSE 中收到的事件。

这让底层 DeepAgent 升级或事件格式变化时，错误停留在边界，而不是以不完整对象进入 UI。

## 18. Web 如何对接

浏览器提交：

```http
POST /api/agent/runs/stream
Accept: text/event-stream
Content-Type: application/json
```

`agent-api.ts` 使用 Fetch 和 `ReadableStream`：

1. `fetch()` 发起 POST；
2. `response.body.getReader()` 获取字节流；
3. `TextDecoder` 把分块字节转换为文本；
4. 按空行拆分 SSE frame；
5. 解析 `data:` JSON；
6. 使用 `AgentStreamEventSchema` 校验；
7. 通过 `onEvent` 更新 React 页面状态。

当用户通过局域网地址打开页面时，浏览器中的 `localhost` 指向用户自己的设备，而不是部署 Web 的服务器。当前 Web 默认请求同源 `/api`，Next.js 服务端再代理到 `http://localhost:4100`，避免跨设备 localhost 和 CORS 问题。

## 19. 可观测性和排错

`runId` 标识一次执行，服务端每条日志都带：

```text
[run:<runId>]
```

排错时应沿同一个 `runId` 查找：

```text
请求是否到达 Controller
→ Root Agent 是否启动
→ 是否调用三个 task
→ 三位专家是否开始和完成
→ 工具是否成功
→ 三份专家文件是否写入
→ Root Agent 是否生成 final-report
→ Runtime 最终校验是否通过
```

`DEEPAGENT_LOG_PROGRESS=1` 控制业务进度日志；`DEEPAGENT_LOG_RAW_EVENTS=1` 可以临时查看原始 LangGraph Event，但不建议生产环境长期打开高噪声日志。

LangSmith Trace 与业务事件用途不同：

- LangSmith：模型调用、Token、延迟、输入输出和调用树；
- Runtime Event：应用 UI 所需的稳定进度；
- Server Log：运维按 `runId` 定位故障；
- Artifact Store：长期保存用户交付物。

它们不能互相替代。

## 20. 前期联调解决的问题

| 现象 | 根因 | 处理方式 |
| --- | --- | --- |
| 开发命令递归启动大量进程 | Workspace dev 命令相互触发 | 使用独立启动脚本管理 API 和 Web |
| 局域网打开页面后 `Failed to fetch` | 浏览器请求了自己的 `localhost:4100` | Web 使用同源 `/api`，Next 服务端代理到 API |
| 看不到问题发生在哪一步 | 缺少请求和运行进度日志 | Controller、Service、Runtime 增加分层日志 |
| `ls("/")` 被拒绝 | 只开放了子路径，没有开放虚拟根目录发现 | 增加只读 `/` 权限 |
| 专家使用错误文件名 | 只约束目录，没有确定产物契约 | 固定专家到产物映射，并设置精确写权限 |
| Root Agent 重复委派 | 模型没有把 task 完成当成终止条件 | 强化 Prompt，并限制 task 总数 |
| 专家反复 `read_file` | 模型陷入工具自检循环 | 强化停止条件，并限制专家工具总数 |
| `GRAPH_RECURSION_LIMIT` | Agent 图长时间未结束 | 具体工具限流 + 保留 recursion 最终熔断 |
| `INVALID_CONCURRENT_GRAPH_UPDATE` | 并行专家同时写有状态限流计数 | 改用无状态消息历史计数 |
| 文件管理器找不到 `/work` | `/work` 是 StateBackend 虚拟路径 | 明确临时工作区与持久化产物的区别 |

## 21. 测试策略

当前测试不是只检查函数能否编译，而是分层验证：

1. 工具单元测试：固定输入得到稳定评分和复杂度；
2. 协议测试：请求和所有 SSE 事件通过 Zod；
3. 离线 Harness 测试：Fake Model 真实驱动 Todo、Task、Skill 和 VFS；
4. 并行回归测试：三个专家同时执行时不产生共享 State 冲突；
5. 失败清理测试：SubAgent 失败不会留下未处理 Promise；
6. 架构边界测试：新工程不导入旧 Chat/API 业务；
7. Live Smoke：显式开启后使用真实 Provider 验证端到端行为。

离线测试证明工程组装和边界；Live Smoke 才能证明特定 Provider、模型、网络和 Tool Calling 组合真实可用。

## 22. 当前还没有实现的生产能力

当前代码是可运行的 DeepAgent MVP，不应误认为已经具备完整生产能力。主要缺口包括：

- 持久化 Checkpointer；
- 跨请求恢复和真正的多轮线程；
- 数据库中的 Run、Todo 和 Artifact 元数据；
- S3、OSS、COS 或 MinIO 产物存储；
- 用户认证、租户隔离和权限审计；
- 服务端运行超时、Token 和费用预算；
- Provider 重试、退避和熔断；
- Human-in-the-loop 审批；
- 内容安全和敏感数据处理；
- 指标、告警、评估集与质量门禁；
- 多实例部署下的共享状态和任务队列。

生产化时推荐保留 StateBackend 或沙箱作为单次运行临时工作区，把最终 Artifact 上传到对象存储，把 Run 元数据写入数据库，不要直接把宿主机源码目录暴露给 Agent。

## 23. 推荐阅读顺序

第一次阅读当前代码时，建议按下面顺序：

1. `packages/deepagent-contracts/src/index.ts`：先看外部协议；
2. `services/deepagent-api/src/agent/prompts/coordinator.prompt.ts`：理解业务目标；
3. `services/deepagent-api/src/agent/tools/requirement.tools.ts`：理解确定性能力；
4. `services/deepagent-api/src/agent/subagents/requirement.subagents.ts`：理解专家和权限；
5. `services/deepagent-api/src/agent/agent.factory.ts`：理解 DeepAgent 组装；
6. `services/deepagent-api/src/agent/workflow-limits.middleware.ts`：理解行为护栏；
7. `services/deepagent-api/src/agent/deepagent.runtime.ts`：理解事件适配和最终校验；
8. `services/deepagent-api/src/agent/agent.service.ts`：理解公开事件和日志；
9. `services/deepagent-api/src/agent/agent.controller.ts`：理解 SSE 和取消；
10. `clients/deepagent-web/lib/agent-api.ts`：理解浏览器如何消费事件。

## 24. 最终结论

当前 `deepagent-api` 的核心并不是“调用一次大模型并返回文本”，而是建立一条受约束、可观察、可验证的 Agent 运行链路：

```text
模型负责推理与表达
Tool 提供确定性能力
Skill 提供稳定方法
SubAgent 隔离复杂任务
Permission 限制资源边界
Middleware 限制非确定性行为
StateBackend 承载临时上下文
Runtime 适配事件并校验交付
Service/Controller 提供安全 SSE 边界
Contracts 保证前后端协议一致
Tests 防止并行、失败和版本兼容问题回归
```

其中 `deepagent.runtime.ts` 最准确的定位是：

> 启动 Root Agent，监听 Root/SubAgent/Tool 的中间生命周期事件，在 Root Agent 完成时获取最终 State，把底层事件和结果转换成应用领域事件，并在返回前执行确定性交付校验。
