# langchain-docs

对照 [LangChain JavaScript 文档](https://docs.langchain.com/oss/javascript/langchain/overview) 实现官网示例。每个示例是一个可直接用 Bun 运行的脚本，模型名和密钥放在本目录的 `.env`。

学习顺序按 `createAgent` 的参数展开，写在 [learning-path.md](learning-path.md)。

```bash
cp services/langchain-docs/.env.example services/langchain-docs/.env
# 填写 LANGCHAIN_MODEL 和对应厂商的 API Key

bun run --filter @autix/langchain-docs list
```

`list` 按 [learning-path.md](learning-path.md) 的顺序打印脚本。

`OPENAI_BASE_URL` 有值且模型是 OpenAI（无前缀或 `openai:`）时，会用 `ChatOpenAI` 走该地址。其它厂商继续使用官网的模型字符串。入口在 [`src/model.ts`](src/model.ts)。

## 目录

示例按官网章节放在 `src/` 下，文件名对应文档小节。

| 目录 | 文档 | 状态 |
| --- | --- | --- |
| `src/quickstart` | [Quickstart](https://docs.langchain.com/oss/javascript/langchain/quickstart) | 可运行 |
| `src/models` | [Models](https://docs.langchain.com/oss/javascript/langchain/models) | 可运行 |
| `src/tools` | [Tools](https://docs.langchain.com/oss/javascript/langchain/tools) | 可运行 |
| `src/messages` | [Messages](https://docs.langchain.com/oss/javascript/langchain/messages) | 可运行 |
| `src/agents` | [Agents](https://docs.langchain.com/oss/javascript/langchain/agents) | 可运行 |
| `src/structured-output` | [Structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output) | 可运行 |
| `src/short-term-memory` | [Short-term memory](https://docs.langchain.com/oss/javascript/langchain/short-term-memory) | 可运行 |
| `src/streaming` | [Streaming](https://docs.langchain.com/oss/javascript/langchain/streaming) | 可运行 |
| `src/event-streaming` | [Event streaming](https://docs.langchain.com/oss/javascript/langchain/event-streaming) | 可运行 |
| `src/middleware` | [Middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/overview) | 钩子可运行 |
| `src/guardrails` | [Guardrails](https://docs.langchain.com/oss/javascript/langchain/guardrails) | 脱敏、拦截、`beforeAgent` 可运行 |
| `src/human-in-the-loop` | [Human-in-the-loop](https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop) | `approve` 与 `reject` 可运行 |
| `src/long-term-memory` | [Long-term memory](https://docs.langchain.com/oss/javascript/langchain/long-term-memory) | 跨 thread 读取可运行。工具内写入见 `src/tools/store.ts` |
| `src/mcp` | [MCP](https://docs.langchain.com/oss/javascript/langchain/mcp) | tools、connections、auth 可运行 |
| `src/multi-agent` | [Multi-agent](https://docs.langchain.com/oss/javascript/langchain/multi-agent) | subagents、handoffs、skills、router、custom workflow 可运行 |
