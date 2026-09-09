# 目录与复用边界

## 1. 全新目录

从 MVP-0 开始创建以下目录：

```text
clients/
  requirement-deepagent-web/        # 全新需求分析 Web

services/
  requirement-deepagent-api/        # 全新 NestJS API 和 DeepAgent runtime

packages/
  requirement-deepagent-contracts/  # 全新 HTTP/SSE/业务类型契约

docs/
  deepagent-requirement-platform/    # 本实施文档
```

这些名称刻意不使用已有的 `deepagent-web`、`deepagent-api` 和 `deepagent-contracts`，以避免“在旧 demo 上继续打补丁”。

## 2. 新 API 内部建议结构

```text
services/requirement-deepagent-api/
  src/
    bootstrap/              # 应用启动和配置校验
    model/                  # 全新模型工厂，只读允许的 env
    agent/
      runtime/              # DeepAgent 创建、调用、取消、恢复
      root/                 # 根 Agent prompt 和收口规则
      subagents/            # 需求/功能/性能/安全/合规专家
      tools/                # 本地工具与统一 tool contract
      events/               # 底层事件 -> 业务事件
      workspace/            # VFS 路由、产物导出与路径规则
    runs/                   # run/thread 状态与接口
    conversations/          # 会话和消息
    artifacts/              # 持久化产物
    knowledge/              # 上传、解析、索引、检索
    approvals/              # HITL 与写工具审批
    observability/          # 日志、trace、metrics、cost
    security/               # 鉴权、输入检查、工具授权
  test/
    unit/
    integration/
    live/                   # 显式开关的真实模型测试
```

### 关键职责边界

- `runtime` 只接收业务请求并产出业务事件，不直接操作 HTTP response。
- `events` 负责过滤和翻译底层事件，Web 不识别 `on_chain_start` 等框架事件。
- `workspace` 明确区分虚拟 `/work` 与持久化 artifact store。
- `subagents` 不直接写数据库；它们通过工具或产物契约输出结果。
- `conversations`、`artifacts` 和 `approvals` 负责业务持久化，不能塞进 Prompt 或 runtime adapter。
- `model` 只负责创建模型客户端，不承载业务路由。

## 3. 唯一允许复用的模型配置

允许沿用环境变量的**名称和已有本地值**：

```dotenv
OPENAI_API_KEY=
OPENAI_BASE_URL=
DEEPAGENT_MODEL=
```

规则：

- 新服务自己实现配置读取和模型工厂，不 import 旧 `model.factory.ts`。
- 不把真实 key 写入 Git；仓库只提交空值的 `.env.example`。
- `OPENAI_BASE_URL` 可为空，表示使用 SDK 默认 endpoint。
- `DEEPAGENT_MODEL` 必须支持 tool calling。
- 兼容旧环境时可在启动层临时用 `OPENAI_MODEL` 作为 fallback，但新项目的正式变量统一为 `DEEPAGENT_MODEL`。
- 诊断接口只返回“是否配置、模型名、连通状态”，绝不返回 key。

## 4. 明确禁止复用的内容

新项目不得 import、复制后改名或直接依赖：

- `services/chat` 的 Controller、Service、LangGraph、数据库模型和 Prompt。
- `services/deepagent-api` 的 runtime、agent factory、event adapter、tools 和日志实现。
- `clients/chat-web` 或 `clients/deepagent-web` 的页面、store、API client 和样式业务代码。
- `packages/deepagent-contracts` 的事件和请求类型。
- `docs/deepagent-first` 中针对简单需求分析 demo 的业务设计。

可以共享但不视为业务复用的仓库基础设施：

- Bun workspace、Turbo 和根 TypeScript 基线。
- 已安装的第三方依赖版本。
- 通用 lint/format/test 约定。
- Docker 中 PostgreSQL、对象存储、向量库等基础设施实例。

共享基础设施不等于共享业务模块。新项目必须拥有自己的 package name、端口、入口、配置校验、契约和测试。

## 5. 依赖方向

```text
requirement-deepagent-web
        |
        v
requirement-deepagent-contracts
        ^
        |
requirement-deepagent-api
        |
        +--> deepagents / LangChain SDK
        +--> model provider
        +--> database / artifact store / vector store
```

Web 与 API 只通过新 contracts 包共享协议。旧服务和旧前端都不在依赖图中。

## 6. MVP-0 的零复用检查

MVP-0 应增加自动检查，确认新目录中不存在指向以下旧业务目录的 import：

```text
services/chat
services/deepagent-api
clients/chat-web
clients/deepagent-web
@autix/deepagent-contracts
```

`services/requirement-deepagent-api/src/bootstrap/load-model-env.ts` 可以读取 `services/chat/.env`，但只能解析模型配置白名单。这是唯一允许出现的旧目录引用，不是代码依赖，并有隔离测试证明 `DATABASE_URL` 等旧配置不会进入新进程。

同时人工确认：

- 新 `.env.example` 不含真实密钥。
- 新模型工厂是独立实现。
- 新页面没有复制旧工作台。
- 新 SSE 事件契约从业务需求重新设计。
- 新 `/work` 处理明确通过 Backend API 读取和导出，不假设磁盘存在该目录。
