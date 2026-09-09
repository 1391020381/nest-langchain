# MVP-0 实施说明

## 1. 本阶段解决什么问题

在开发业务 Agent 前，先独立验证四件事：

1. 新 Web 能访问新 API。
2. 新 API 能读取模型配置，但不会泄露 key。
3. 模型服务可以连通。
4. 所选模型确实支持 DeepAgent 必需的 tool calling。

如果跳过这一层，后面出现“点击无反应”时，很难区分是 Web 代理、API、环境变量、provider 还是模型能力的问题。

## 2. 新增目录

```text
packages/requirement-deepagent-contracts
services/requirement-deepagent-api
clients/requirement-deepagent-web
```

三个 workspace 都是新实现，没有导入旧 `services/chat`、`services/deepagent-api`、`clients/deepagent-web` 或旧 contracts。

## 3. 请求链路

```text
浏览器 :3200
  -> Next.js 同源 /api 代理
  -> NestJS :4200
  -> 读取公开配置摘要
  -> ChatOpenAI 发送最小请求
  -> 强制调用 mvp0_capability_probe
  -> 返回 ready 或明确失败码
```

Web 使用 Next.js rewrite 访问 API，因此从局域网打开页面时不会把请求错误地发往访问者电脑的 `localhost:4200`，也不会依赖浏览器跨域访问。

## 4. 环境变量加载规则

优先级为：

```text
进程环境变量 > 新服务 .env > 已有模型环境中的白名单变量
```

新服务可以拥有自己的完整配置。兼容阶段会从仓库根 `.env` 和 `services/chat/.env` 中只读取以下白名单，不会导入旧服务的其他配置或代码：

```text
OPENAI_API_KEY
OPENAI_BASE_URL
DEEPAGENT_MODEL
OPENAI_MODEL（仅作为兼容 fallback）
```

推荐做法是复制新服务的示例文件：

```powershell
Copy-Item services/requirement-deepagent-api/.env.example services/requirement-deepagent-api/.env
```

如果根 `.env` / `services/chat/.env` 已经存在有效模型配置，可以不复制 key；新服务会按白名单读取。等新项目拥有独立部署配置后，可以删除这个兼容 fallback。

## 5. API

| 接口 | 作用 | 是否调用模型 |
| --- | --- | --- |
| `GET /api/health/live` | 验证 NestJS 进程可访问 | 否 |
| `GET /api/health/ready` | 验证模型 key 是否配置 | 否 |
| `POST /api/diagnostics/model` | 验证 provider、模型和 tool calling | 是 |

诊断失败会返回以下公开错误码之一：

- `MODEL_NOT_CONFIGURED`
- `AUTHENTICATION_FAILED`
- `MODEL_NOT_FOUND`
- `TOOL_CALLING_UNSUPPORTED`
- `PROVIDER_REJECTED_REQUEST`
- `PROVIDER_TIMEOUT`
- `PROVIDER_UNAVAILABLE`
- `UNKNOWN_PROVIDER_ERROR`

公开响应只包含模型名、是否配置 key、是否配置自定义地址和诊断结果，不包含 key 或完整 provider 错误正文。

## 6. 启动与体验

在仓库根目录执行：

```powershell
bun install
bun run dev:requirement-deepagent
```

打开：

```text
http://localhost:3200
```

页面自动检查 API 存活和模型配置。点击“检查模型能力”后，API 会执行一次最小 tool-calling 请求。

成功时三个卡片依次显示：

```text
API 服务       ALIVE
模型配置       CONFIGURED
Tool Calling   SUPPORTED
```

该按钮会调用真实 provider，并产生少量 token 消耗。

## 7. 局域网访问

页面已监听 `0.0.0.0:3200`。如果 Next.js 提示开发资源来源被阻止，在新 Web 的 `.env` 中加入当前访问主机名或 IP：

```dotenv
NEXT_ALLOWED_DEV_ORIGINS=172.5.204.37
```

然后重启开发服务。API 请求仍通过 Next.js 同源代理转发，不需要把浏览器请求地址改成 `localhost:4200`。

## 8. 验证命令

```powershell
bun run typecheck:requirement-deepagent
bun run test:requirement-deepagent
bun run build:requirement-deepagent
```

标准测试不会请求真实模型。只有在页面点击诊断按钮，或以后显式开启 live test 时，才会产生真实模型请求。

## 9. 本阶段明确没有做的内容

- 没有创建需求分析 Agent。
- 没有使用 `createDeepAgent`。
- 没有会话、数据库、SSE、RAG 或业务工具。
- 没有复制旧工作台 UI。

这些能力从 MVP-1 开始逐步增加。MVP-0 的唯一目的，是让后续问题能够快速归因到“业务 Agent”而不是基础连接。
