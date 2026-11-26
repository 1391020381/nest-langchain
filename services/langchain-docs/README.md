# langchain-docs

对照 [LangChain JavaScript 文档](https://docs.langchain.com/oss/javascript/langchain/overview) 实现官网示例。每个示例是一个可直接用 Bun 运行的脚本，模型名和密钥放在本目录的 `.env`。

```bash
cp services/langchain-docs/.env.example services/langchain-docs/.env
# 填写 LANGCHAIN_MODEL 和对应厂商的 API Key

bun run --filter @autix/langchain-docs list
bun run --filter @autix/langchain-docs quickstart
bun run --filter @autix/langchain-docs quickstart:system-prompt
bun run --filter @autix/langchain-docs quickstart:fetch-text-from-url
bun run --filter @autix/langchain-docs quickstart:model
bun run --filter @autix/langchain-docs quickstart:memory
bun run --filter @autix/langchain-docs quickstart:research-agent
bun run --filter @autix/langchain-docs agents:system-prompt
bun run --filter @autix/langchain-docs agents:structured-output
bun run --filter @autix/langchain-docs agents:agent-state
bun run --filter @autix/langchain-docs agents:invocation
bun run --filter @autix/langchain-docs agents:streaming
bun run --filter @autix/langchain-docs models:init
bun run --filter @autix/langchain-docs models:invocation
bun run --filter @autix/langchain-docs models:tool-calling
bun run --filter @autix/langchain-docs models:structured-output
bun run --filter @autix/langchain-docs models:advanced
bun run --filter @autix/langchain-docs messages:basic
bun run --filter @autix/langchain-docs messages:types
bun run --filter @autix/langchain-docs messages:content
bun run --filter @autix/langchain-docs messages:notifications
bun run --filter @autix/langchain-docs messages:serialization
```

`OPENAI_BASE_URL` 有值且模型是 OpenAI（无前缀或 `openai:`）时，会用 `ChatOpenAI` 走该地址。其它厂商继续使用官网的模型字符串。

## 目录

示例按官网章节放在 `src/` 下，文件名对应文档小节。

| 目录 | 文档 |
| --- | --- |
| `src/quickstart` | [Quickstart](https://docs.langchain.com/oss/javascript/langchain/quickstart) |
| `src/agents` | [Agents](https://docs.langchain.com/oss/javascript/langchain/agents) |
| `src/models` | [Models](https://docs.langchain.com/oss/javascript/langchain/models) |
| `src/messages` | [Messages](https://docs.langchain.com/oss/javascript/langchain/messages) |
| `src/tools` | [Tools](https://docs.langchain.com/oss/javascript/langchain/tools) |
| `src/short-term-memory` | [Short-term memory](https://docs.langchain.com/oss/javascript/langchain/short-term-memory) |
| `src/streaming` | [Streaming](https://docs.langchain.com/oss/javascript/langchain/streaming) |
| `src/structured-output` | [Structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output) |
| `src/middleware` | [Middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/overview) |
| `src/guardrails` | [Guardrails](https://docs.langchain.com/oss/javascript/langchain/guardrails) |
| `src/human-in-the-loop` | [Human-in-the-loop](https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop) |
| `src/long-term-memory` | [Long-term memory](https://docs.langchain.com/oss/javascript/langchain/long-term-memory) |
| `src/mcp` | [MCP](https://docs.langchain.com/oss/javascript/langchain/mcp) |
| `src/multi-agent` | [Multi-agent](https://docs.langchain.com/oss/javascript/langchain/multi-agent) |
