# 第 6 章：本地最小异步验证（TypeScript 单部署）

对应[教程最小验证方案](https://datawhalechina.github.io/deepagents-in-action/chapters/ch06-async-subagents/)。按本项目要求使用 TypeScript：两个图在同一个官方 JS Agent Server 中，Supervisor 通过 HTTP 回环地址访问 researcher。Python 教程的 ASGI 进程内传输不适用于此实现。

## 启动

先在仓库根目录 `bun install`。需要 Node.js 20+（本机使用 22）和 Bun。复用 `services/deepagents-in-action/.env` 的模型配置与 LangSmith 配置，不需要 Tavily。示例不执行真实搜索，只有 Supervisor 调用模型。

可在 `.env` 添加：

```dotenv
ASYNC_DEMO_URL=http://127.0.0.1:2024
ASYNC_DEMO_DELAY_SECONDS=8
```

终端 1（在 `services/deepagents-in-action` 下）：

```powershell
bun run async:server
```

该命令用 `langgraphjs dev` 启动一个本地服务，注册 `supervisor` 与 `researcher`，配置 4 个 worker 槽位。保持终端运行。无需 Python、Docker 或额外数据库；这是开发服务，不是生产部署。

终端 2（同一目录）：

```powershell
# 真实 Supervisor：启动 → 问进度 → 追加约束 → 回收结果
bun run async:demo

# 可先验证服务协议，不调用模型：后台启动 → interrupt 更新 → 回收结果
bun run async:protocol
```

默认研究节点等待 8 秒，返回三条模拟说明，并保留收到的任务及追加约束。更新调用在同一个子线程上 interrupt 旧 run、创建新 run，不是修改正在运行节点的局部变量。

## 验证点

- 启动 API 只返回后台任务信息，不等待研究完成。
- 主线程与子线程不同；`taskId` 等于子线程 ID，后续追加指令保持该 ID 不变，`runId` 改变。
- 后台状态最终为 `success`，结果包含追加约束。
- 8 秒是子任务延迟，不是整个 Supervisor 回复耗时保证；模型本身可能慢于 8 秒，因此问进度时已是 success 也正常。需要观察 running 可把延迟调到 30 秒。
- SDK 验证脚本有 120 秒结果等待上限；失败会非零退出，不把工具返回的错误文本当成验证通过。

`async:protocol` 不验证模型是否正确选择工具；`async:demo` 才覆盖该部分。LangSmith 可按主/子 thread ID 关联记录。关闭追踪时仍可通过本地 SDK 查看状态。

改端口时同时修改启动命令 `--port` 与 `ASYNC_DEMO_URL`。如果出现 HTTP 402，检查模型平台余额；连接失败先确认终端 1 的服务就绪；运行挂起先检查 worker 并发。此处不为图手动设置 checkpointer，状态由 Agent Server 管理。

文件：`langgraph.json` 注册图，`supervisor.ts` 配置原生 AsyncSubAgent，`researcher.ts` 定义慢图，`run-demo.ts` 使用官方 SDK 验证。

参考：[官方 JS 本地服务](https://docs.langchain.com/oss/javascript/langgraph/local-server)、[异步子 Agent](https://docs.langchain.com/oss/javascript/deepagents/async-subagents)。
