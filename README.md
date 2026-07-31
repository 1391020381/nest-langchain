# nest-langchain

一个面向已有 NestJS 经验开发者的 LangChain.js 实践项目。重点不是 NestJS 基础，而是通过可调用 API 学习：

- Chat Model、Messages、Streaming
- RunnableSequence、RunnableParallel
- Zod 结构化输出
- Tool Calling 与 Agent
- 文档切分、Embedding、Vector Store 和两阶段 RAG
- LangGraph 条件路由、Checkpointer 与会话状态
- LangSmith Trace 与评估思路

## 环境要求

- Node.js 20+
- pnpm 9+
- 一个 OpenAI 或 OpenAI 兼容模型接口

## 快速开始

```bash
pnpm install
Copy-Item .env.example .env
pnpm start:dev
```

编辑 `.env`，至少填写：

```dotenv
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
CHAT_MODEL=gpt-5-mini
EMBEDDING_MODEL=text-embedding-3-small
```

服务启动后：

- API：<http://localhost:3000/api>
- Swagger：<http://localhost:3000/docs>
- 请求示例：[`docs/api-examples.http`](docs/api-examples.http)
- 完整学习路线：[`docs/learning-path.md`](docs/learning-path.md)

没有配置模型密钥时，应用依然可以启动，并可运行 LangGraph 路由示例和不依赖模型的测试。

## 模块与课程对应关系

| 目录            | 学习主题                                          |
| --------------- | ------------------------------------------------- |
| `src/langchain` | Models、Messages、Runnable、Streaming、结构化输出 |
| `src/tools`     | 工具 Schema、业务边界、用户权限                   |
| `src/knowledge` | 文档切分、Embedding、Vector Store、RAG            |
| `src/agents`    | `createAgent`、多步工具调用、轨迹观察             |
| `src/graphs`    | StateGraph、条件路由、MemorySaver                 |
| `docs`          | 分阶段练习、API 请求样例                          |

## 推荐练习顺序

1. 调用 `/api/langchain/chat`，观察 Message 和 usage metadata。
2. 修改 RunnableParallel，加入分类和风险提取。
3. 手动实现一次完整 Tool Calling Loop，再对比 `createAgent`。
4. 导入自己的文档，系统性比较分块和 Top-K。
5. 将内存向量库替换为生产向量库。
6. 扩展退款 LangGraph，并加入人工审批和持久化 Checkpointer。
7. 建立固定评估集，比较不同 Prompt、模型和检索参数。

## 验证

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## 重要说明

- `currentUserId` 出现在请求 DTO 中只是为了方便课程演示。生产环境必须从认证 Guard 或受信任上下文中获得。
- `MemoryVectorStore` 和 `MemorySaver` 仅适用于本地学习。生产环境需更换为持久化存储。
- 写操作工具必须具有权限检查、确认机制和幂等键。
- 不要提交 `.env` 或任何 API Key。

## License

MIT
