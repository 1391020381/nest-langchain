# Design: 第四章 LangChain 进阶——记忆、工具与多 Agent

**Date:** 2026-08-02  
**Status:** Approved for implementation planning  
**Source:** `docs/AI Agents 开发实践/6-第四章：LangChain 进阶——记忆、工具与多 Agent.md`  
**Branch:** `feat/LangChain-Advanced`

## Goal

在现有 `services/api`（第三章能力已落地）上，按第四章递进接入 Memory、业务 Tools、Embeddings + Vector Store、Fixed Workflow Multi-Agent，并收束为统一入口：

`POST /api/advanced/analyze` → 多轮上下文 + 五 Agent 分析 + 工单落盘 + 记忆写回

同时保留各能力的单点验收 HTTP 接口，使章内 curl 可独立验证。

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | 整章 4.2–4.6 一次设计/实现 |
| Entry shape | 统一 `analyze()` + 各能力单点验收接口 |
| Storage | 教学路径：进程内 `InMemoryChatMessageHistory` + `MemoryVectorStore`（重启即丢） |
| Frontend | 不做 Web 演示页 |
| `analyze()` wiring | 仅 Memory + Orchestrator + 写 tickets + `appendMessage`；不嵌 Tools/Embedding |
| Module layout | 新建 `AdvancedModule`，按能力拆 Controller（方案 1） |
| Ports | API 固定 `3001`（课本部分示例写 3000，验收以本仓为准） |
| Existing Ch3 | 不改 `LlmModule` 行为；复用 `createChatModel()` |
| Persistence / pgvector | 不做；留给第五章 |

## Architecture

```
client (curl)
    │
    ├─ POST /api/memory/*          单点：多轮记忆
    ├─ POST /api/files/file-chat   单点：业务工具
    ├─ POST /api/embedding/*       单点：嵌入 + 检索
    ├─ POST /api/agents/orchestrate 单点：多 Agent
    └─ POST /api/advanced/analyze  主链路
            │
            ▼
services/api (:3001)
├─ src/llm/                     # 第三章文件保留；第四章以子目录/新文件叠加
│   ├─ model.factory.ts         # 复用
│   ├─ advanced.module.ts
│   ├─ memory/ · filesystem/ · embedding/ · agents/
│   └─ tools/business.tools.ts
└─ workspace/                   # 业务沙箱（相对 api 包 process.cwd）
```

**主链路数据流**

```
POST /api/advanced/analyze { sessionId, input }
  → Memory.getHistory(sessionId)
  → 拼接 enrichedInput（历史 + 当前输入）
  → Orchestrator.orchestrate(enrichedInput)
       extract
         → 缺 orderId / requestType？→ need_clarification 返回
         → Promise.all(policyCheck, riskReview) → qa → summary
  → 无澄清：write tickets/{orderId}-analysis.md
  → Memory.appendMessage(sessionId, input, reportOrClarification)
  → 返回 orchestrate 结果
```

## Module & file plan

```
services/api/
  workspace/
    orders/EC20240315001.json
    products/headphone-x1.json
    policies/return-policy.md
    policies/refund-policy.md
    faq/after-sale-faq.md
    tickets/                          # 运行时写入，可 gitignore 生成物
  src/
    app.module.ts                     # imports: LlmModule, AdvancedModule
    llm/
      model.factory.ts                # 复用，不改
      tools/basic.tools.ts            # 第三章保留
      tools/business.tools.ts         # query_order / query_product / read_file / write_file + safePath
      memory/
        runnable-memory.service.ts
        memory.controller.ts          # @Controller('api/memory')
      filesystem/
        filesystem.service.ts         # tool-loop 绑定 business tools
        files.controller.ts           # @Controller('api/files')
      embedding/
        embedding.service.ts
        vector-store.service.ts
        embedding.controller.ts       # @Controller('api/embedding')
      agents/
        sub-agents.ts                 # 5 条独立链
        orchestrator.service.ts
        agents.controller.ts          # @Controller('api/agents')
      advanced-analysis.service.ts
      advanced.controller.ts          # @Controller('api/advanced')
      advanced.module.ts
```

### Dependencies

按章安装（实现时核对当前 langchain 版本可用导入路径）：

- `@langchain/community` + `@xenova/transformers`
- Embeddings 实现顺序：优先 `HuggingFaceTransformersEmbeddings`（章内 Prompt）；若当前依赖组合导入/运行失败，则改为直连 `@xenova/transformers` pipeline，对外仍只暴露 `embedQuery` / `embedDocuments`
- 若 `MemoryVectorStore` 不在主包导出路径，从 `@langchain/classic/vectorstores/memory` 引入

### Controllers

| Controller | Methods |
|------------|---------|
| `api/memory` | `POST chat` · `GET history` · `DELETE clear` |
| `api/files` | `POST file-chat` |
| `api/embedding` | `POST store` · `POST search` |
| `api/agents` | `POST orchestrate` |
| `api/advanced` | `POST analyze` |

## Capability contracts

### 4.2 Memory (`RunnableMemoryService`)

- `RunnableWithMessageHistory` + `InMemoryChatMessageHistory`，按 `sessionId` 隔离
- `trimMessages`：`maxTokens: 2000`，`strategy: 'last'`，`includeSystem: true`
- API：
  - `POST /api/memory/chat` body `{ sessionId, input }` → `{ response }`
  - `GET /api/memory/history?sessionId=` → 消息列表
  - `DELETE /api/memory/clear?sessionId=` → 清除会话
- 服务方法：`chat` · `getHistory` · `appendMessage` · `clearSession`
- `appendMessage` 供 `analyze()` 写回结论，不再次调用模型

### 4.3 Tools / Files

- Tools：`query_order` · `query_product` · `read_file` · `write_file`
- 全部经 `safePath()` 限制在 `workspace/`；越权返回「路径不允许逃逸工作目录」
- `FilesystemService` 复用第三章 tool-loop：模型决定是否/如何调用工具
- `POST /api/files/file-chat` body `{ input }` → 模型回复（可含工具结果）

### 4.4 Embedding + Vector Store

- 模型：`Xenova/paraphrase-multilingual-MiniLM-L12-v2`（本地）
- `EmbeddingService`：`embedQuery` · `embedDocuments`
- `VectorStoreService`：`MemoryVectorStore`；`addDocuments` · `similaritySearch`
- API：
  - `POST /api/embedding/store` body `{ documents: [{ content, metadata }] }` → `{ added: N }`
  - `POST /api/embedding/search` body `{ query, topK }` → 相似文档列表
- **灌库策略（锁定）**：不在启动时自动灌库；验收用 `POST store` 显式灌入。`workspace/policies/*` 与 `faq/*` 作为 Tools 读取的源文件，也可手工把其内容再 store 进向量库
- 进程重启后向量数据丢失，需重新 store

### 4.5 Multi-Agent (`OrchestratorService`)

- 五角色（各自 `ChatPromptTemplate + model + StringOutputParser`）：
  - `RequirementExtractAgent`：抽取 `orderId` · `productId` · `requestType` · `receivedDate` · `isUnopened`（JSON）
  - `PolicyCheckAgent`
  - `RiskReviewAgent`
  - `QAAgent`（Given-When-Then）
  - `SummaryAgent`
- Fixed workflow：`extract → Promise.all(policy, risk) → qa → summary`
- 缺 `orderId` 或 `requestType` →

  ```json
  {
    "mode": "fixed_workflow",
    "status": "need_clarification",
    "clarificationQuestions": ["..."],
    "usedAgents": ["RequirementExtractAgent"],
    "fallback": "ask_user"
  }
  ```

- 异常 → `fallback: "manual_review"`，附简短 `report` / `error`
- 成功 → `mode` · `clarificationQuestions: []` · `usedAgents`（5 个）· `fallback: null` · `steps` · `report`

### 4.6 Analyze (`AdvancedAnalysisService`)

1. `getHistory(sessionId)`
2. 拼接 `enrichedInput`
3. `orchestrator.orchestrate(enrichedInput)`
4. 若无澄清问题：通过 `FilesystemService` 的安全写文件方法写入 `tickets/{orderId}-analysis.md`（不走 `file-chat` tool-loop）  
   - `orderId` 优先取抽取结果；否则案例默认 `EC20240315001`
5. `appendMessage(sessionId, input, content)`  
   - 成功：`content = report`  
   - 需澄清：`content` 为澄清说明（含 `clarificationQuestions` 文本）；**仍 append，不写 tickets**
6. 返回 orchestrate 结果

## Seed data (minimal)

| Path | Purpose |
|------|---------|
| `workspace/orders/EC20240315001.json` | 订单详情（蓝牙耳机、收货信息） |
| `workspace/products/headphone-x1.json` | 商品售后约束 |
| `workspace/policies/return-policy.md` | 7 天无理由、未拆封等 |
| `workspace/policies/refund-policy.md` | 退款时效说明 |
| `workspace/faq/after-sale-faq.md` | 降噪/质量投诉 FAQ |

内容需足以支撑案例结论：未拆封 + 符合 7 天无理由 → 可退，并给出下一步操作建议。

## Error handling

| Scenario | Behavior |
|----------|----------|
| 未知 `sessionId` | `history` → `[]`；`chat` 自动创建会话 |
| 订单/商品/文件不存在 | 工具返回 `{ error }`，服务不崩溃 |
| 路径逃逸 `workspace/` | 工具拒绝，返回逃逸错误文案 |
| Extract JSON 解析失败 | `fallback: "manual_review"` |
| 缺关键字段 | `need_clarification`，提前结束 |
| Embedding 模型未就绪 | store/search 返回明确错误（首次加载可能较慢，可在 `onModuleInit` 预热） |
| `analyze` 需澄清 | 不写 tickets；仍 `appendMessage` 写澄清说明 |

## Acceptance (curl, base `http://localhost:3001`)

1. **Memory**：同 `sessionId` 四轮；第四轮识别订单/品类；history 含 8 条；clear 后为空  
2. **Files**：查订单、读政策、写 tickets、越权被拒  
3. **Embedding**：store 返回 `added`；search「蓝牙耳机未拆封能退货吗」首条相关 policy/faq  
4. **Agents**：完整输入 → 5 agents + report；仅「我想退货」→ clarification  
5. **Analyze**：同 session 四轮；第四轮完整 report；tickets 落盘；history 最后一条 AI 为报告/结论文本（非重跑闲聊）

## Testing strategy

- 主验收：章内 curl（端口改为 3001）
- 可选单测（不强制 LLM e2e）：
  - `safePath` 越权拒绝
  - Orchestrator clarification 分支（可 mock extract 输出）
  - Analyze 在澄清时不写文件

## Out of scope

- Web UI / 前端演示页
- 数据库会话持久化、Redis、pgvector（第五章）
- `analyze()` 内调用 Tools 或 Embedding 检索
- Router / Supervisor / Handoff / Planner-Executor 等非 Fixed Workflow 模式
- 改写第三章 `LlmController` / `RequirementService` 行为
- 生产级审计日志、可写目录细粒度 ACL（仅保留 `safePath` 沙箱）

## Implementation notes

- 贯穿案例：订单 `EC20240315001`，四轮退货咨询固定文案见源课本
- 写回记忆优先 `appendMessage`，避免对结论再跑一轮 chat 模型
- `workspace/tickets/` 运行时产物建议加入 `.gitignore`（种子订单/政策保留入库）
- 课本旁注中的「生产路径」（DB messages、pgvector）仅作对照，本设计不实现
