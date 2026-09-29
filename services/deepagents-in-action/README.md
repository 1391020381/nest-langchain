# Deep Agents 实战：TypeScript 示例

第一阶段：[LangChain 四个基础概念](ch01-langchain-foundations/README.md)，运行 `bun run foundations`，手写并观察 Message、Model、Tool 与 Agent loop。

第二阶段：[观察 DeepAgent Harness](ch03-harness-observation/README.md)，运行 `bun run harness:observe`，对照观察 Message、Tool、Todo 和虚拟文件状态。

第三阶段：[用原生 LangGraph 实现人工介入](ch05-native-langgraph-hitl/README.md)，运行 `bun run hitl:native` 并打开 `http://127.0.0.1:2030`，在浏览器中观察 `interrupt()`、checkpoint、`thread_id` 与 `Command({ resume })`。

第 9 章：[Human-in-the-Loop 后端 + Web 审批示例](ch09-human-in-the-loop/README.md)，运行 `bun run hitl:demo`，打开 `http://127.0.0.1:2029`；使用真实模型运行 `bun run hitl`。

第 6 章：[本地单部署异步子 Agent 验证](ch06-async-subagents/README.md)，启动 `bun run async:server`，另开终端执行 `bun run async:demo`。

第 4 章：[规划并执行研究任务](ch04-task-planning/README.md)，运行 `bun run planning`，实时查看计划和虚拟文件。

对应 [Datawhale 第 2 章 Hello World](https://datawhalechina.github.io/deepagents-in-action/chapters/ch02-quickstart/)。使用项目已有的 Deep Agents JS 依赖，无需 Python、AgentSeek、数据库或 Web 服务。

## 运行

在仓库根目录执行 `bun install`（已经安装依赖可跳过）。在 `services/deepagents-in-action/.env` 中配置模型；已有文件请编辑，不要覆盖。

课程使用硅基流动，可添加：

```dotenv
SILICONFLOW_API_KEY=你的密钥
MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
```

模型应在你的账户中可用且支持工具调用。如果配置了 `SILICONFLOW_API_KEY`，本示例优先使用它，并固定连接 `https://api.siliconflow.cn/v1`。

也可以复用项目现有的配置（此时不设置 `SILICONFLOW_API_KEY`）：

```dotenv
OPENAI_API_KEY=你的密钥
OPENAI_BASE_URL=https://你的模型服务地址/v1
OPENAI_MODEL=你的模型名称
```

这一模式中 `DEEPAGENT_MODEL` 优先于 `OPENAI_MODEL`。进程环境变量优先于 `.env`；不要提交密钥。

```powershell
bun run demo:deepagent-hello
# 或输入其他城市的问题
bun run demo:deepagent-hello "上海今天天气怎么样？"
```

预期先打印问题，再打印 `[工具调用] get_weather(...)`，最后输出中文回复。天气固定为晴、28°C、微风，属于模拟数据；真实运行需要调用模型 API。

也可以进入本目录独立运行：

```powershell
cd services/deepagents-in-action
# 初次配置且不存在 .env 时执行，然后填写密钥
Copy-Item .env.example .env
bun run hello
bun run typecheck
```

## 阅读和修改代码

### 小试牛刀：计算器 Agent

在 `services/deepagents-in-action` 中运行（与 Hello World 共用 `.env`）：

```powershell
bun run calculator
bun run calculator "计算 (12 + 8) * 3 / 2"
bun run test
bun run typecheck
```

入口：[calculator.ts](ch02-quickstart/calculator.ts)。工具：[calculator-tools.ts](ch02-quickstart/calculator-tools.ts)。

默认问题与教程一致：将 100 美元换成人民币，再乘以 1.08。预期模型先调用 `convert_currency` 得到 720 CNY，再调用 `calculate` 得到 777.6。调用顺序由模型决定，日志会显示实际调用参数。

`calculate` 支持四则运算、小数、负数和括号，使用专用表达式解析，不执行 `eval`。`convert_currency` 支持 USD、CNY、EUR，目标币种默认 CNY，采用固定演示汇率并保留两位小数。运算使用 JavaScript 浮点数，本示例用于学习工具调用。

### 实战：研究助手

入口：[research.ts](ch02-quickstart/research.ts)，搜索工具：[research-tools.ts](ch02-quickstart/research-tools.ts)。

在本目录 `.env` 中添加 `TAVILY_API_KEY=你的密钥`（从 [Tavily](https://app.tavily.com/) 获取），模型配置与其他示例共用。然后在本目录运行：

```powershell
bun run research
bun run research "LangGraph 和 LangChain 的区别是什么？请引用官方资料。"
```

默认研究“什么是 LangGraph？”。终端显示 `internet_search` 调用和来源数量，最终打印带来源链接的中文报告。搜索使用 [Tavily 官方 HTTP 接口](https://docs.tavily.com/documentation/api-reference/endpoint/search)，无需安装额外 SDK。

工具参数对应课程：`query`、`max_results`（默认 5，本例限制 1–10）、`topic`（general/news/finance）、`include_raw_content`（默认 false）。默认 basic 搜索；模型 API 和 Tavily 搜索均使用各自账户额度。内容做长度限制，避免原文占满上下文。

缺少搜索密钥时会在调用模型前停止；搜索服务失败会报错，不使用模拟搜索冒充真实研究。`bun run test` 中的搜索测试使用离线响应，不需要密钥，也不代表真实联网验收。当前固定的 Deep Agents JS 版本保留其默认规划能力；没有照搬 Python v0.7 的中间件配置。

### 调试与追踪：LangSmith

研究助手已接入 LangChain 自动追踪。已有 `@langchain/core` 间接安装了 LangSmith SDK，无需新增依赖。`internet_search` 虽使用 HTTP 调用 Tavily，但它被注册为 LangChain 工具，因此工具输入、输出、耗时和错误也会被记录。

1. 登录 [LangSmith](https://smith.langchain.com/)，在 Settings 的 API Keys 中创建密钥。
2. 在本目录 `.env` 中追加或修改以下配置（不要覆盖已有模型和 Tavily 配置）：

```dotenv
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=你的LangSmith密钥
LANGSMITH_PROJECT=deepagents-in-action-ch02
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
```

Endpoint 必须与账号区域一致，其他区域使用控制台提供的地址；多工作区密钥需要时设置 `LANGSMITH_WORKSPACE_ID`。开启追踪后，问题、模型与工具的输入输出将上传至 LangSmith。

3. 在本目录执行 `bun run research "什么是 LangGraph？"`。
4. 在 LangSmith 的 Tracing 中打开 `deepagents-in-action-ch02` 项目，找到 `ch02-research-assistant` 运行，展开模型和 `internet_search` 子调用。

可查看搜索参数、返回来源、调用先后、耗时和错误；token 用量取决于模型服务是否返回 usage。这里记录的是调用过程，不是模型未公开的内部思考。运行名称、tags 和非敏感 metadata 已写入研究助手，便于筛选。

脚本设置 `LANGCHAIN_CALLBACKS_BACKGROUND=false`，并在成功/失败结束时等待回调，减少短脚本退出导致追踪丢失的情况。终端的“追踪已启用”表示本地配置有效，不代表远端上传已验收；仍需在控制台确认记录。

设置 `LANGSMITH_TRACING=false` 即可关闭（若进程中已有旧版 `LANGCHAIN_TRACING_V2` 等变量，也应清除）。无记录时检查追踪开关、密钥、区域、工作区、网络和控制台项目名称。测试使用隔离的环境对象，不发送追踪数据。

参考：[LangChain 官方追踪指南](https://docs.langchain.com/langsmith/trace-with-langchain)。

### Hello World 代码对照

入口：[hello.ts](ch02-quickstart/hello.ts)。

| 教程 Python | 本项目 TypeScript |
| --- | --- |
| `ChatOpenAI(...)` | `new ChatOpenAI(...)` |
| Python 工具函数与类型标注 | `DynamicStructuredTool` 的 `func`、`description` 和 Zod `schema` |
| `create_deep_agent(...)` | `createDeepAgent(...)` |
| `system_prompt` | `systemPrompt` |
| `agent.invoke(...)` | `await agent.invoke(...)` |

修改 `systemPrompt` 可以改变助手行为；修改 `getWeather.func` 可以改变工具逻辑；新增工具后放入 `tools` 数组。模型通过工具名称、说明和参数结构决定如何调用函数。最后一条 `result.messages` 是最终回复。

官方接口参考：[Deep Agents JS Quickstart](https://docs.langchain.com/oss/javascript/deepagents/quickstart)。
