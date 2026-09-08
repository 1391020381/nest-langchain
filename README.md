# nest-langchain

《AI Agents 开发实践》的配套仓库，同时提供两条互补路线：教材继续按 LangChain、LangGraph、向量/RAG，最后迁移到 DeepAgent；新工程则从独立目录直接采用 DeepAgent-first 实现。

> 远程仓库地址保持不变。教材配套旧应用继续保留用于学习和对照；早期学习笔记见 [`docs/archive/`](docs/archive/)。

## 本仓里有什么

| 内容 | 路径 | 说明 |
| --- | --- | --- |
| 课本 | [`docs/AI Agents 开发实践/`](docs/AI%20Agents%20开发实践/) | 序章 → 第二十章 + 终章 + 面试篇 |
| 学习进度 | [`docs/learning-path.md`](docs/learning-path.md) | 章节勾选、官方对照分支、当前下一步 |
| DeepAgent-first 指南 | [`docs/deepagent-first/`](docs/deepagent-first/) | 在全新目录中直接实现需求分析 Agent |
| 教材配套工程 | `services/chat`、`clients/chat-web` | 保留原有按章演进代码，不作为新工程的实现目录 |
| DeepAgent-first 工程 | `services/deepagent-api`、`clients/deepagent-web`、`packages/deepagent-contracts` | 与旧工程隔离的新 API、Web 与共享协议 |

## 怎么学

1. 要系统理解原理与迁移过程，打开 [`docs/learning-path.md`](docs/learning-path.md)，继续按教材顺序学习。
2. 要直接建设当前项目，打开 [DeepAgent-first 实践指南](docs/deepagent-first/README.md)，从全新目录开始逐步实现。
3. 两条路线共享工程底座和基础设施，但学习进度与工程完成度分开记录。

## 教材路线既有状态

- [x] 保留教材书稿与配套练习工程
- [x] 保留书稿并建立新学习路线
- [x] 序章 / 第一章要点已对齐
- [x] 第二章 monorepo 工程底座（`bun install` / API `/health` `/hello` / Web `:3002` 已验收）

## DeepAgent-first 当前状态

- [x] 三个新 workspace 与旧应用隔离
- [x] DeepAgent 规划、Subagent、Skill、StateBackend，以及 SSE 协议与错误链路基线
- [x] 生产流采用 v2 raw-event 适配，规避当前依赖组合下 v3 重复 Subagent 失败时的未处理 Promise
- [x] 只允许三位具名专家，最终结果强制校验三次委派、四份产物和全部 completed todos
- [x] 新 contracts、API、Web 的类型检查与生产构建
- [x] 30 项离线测试通过，真实 provider 测试按设计跳过
- [x] API `/health`、`/api/agent/info` 与无密钥错误流验证
- [ ] 配置真实模型后的 live smoke、数据库/RAG、持久化与 HITL

### DeepAgent-first 启动

```bash
bun install
bun run dev
```

- Web：<http://localhost:3100>
- API：<http://localhost:4100/health>、<http://localhost:4100/api/agent/info>
- 模型配置、流式调用与分层验收见 [DeepAgent-first 实践指南](docs/deepagent-first/README.md)。

### 教材配套应用启动

```bash
bun install
bun run dev:legacy-chat
```

- Web：<http://localhost:3002>（应显示 `llm`，点击「调用 API」）
- Chat：<http://localhost:4001/hello>、<http://localhost:4001/health>

可选 Compose：

```bash
docker compose -f infra/compose/compose.yaml -f infra/compose/compose.dev.yaml up --build
```

## 可选对照仓库

```bash
# 仅作只读参考，不要改成你的 origin
git clone https://github.com/Cookieboty/autix-demo.git ../autix-demo
```

## License

MIT
