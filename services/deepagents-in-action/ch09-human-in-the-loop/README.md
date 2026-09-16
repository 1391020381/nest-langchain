# 第 9 章：Human-in-the-Loop（TypeScript 后端 + Web）

对应[课程章节](https://datawhalechina.github.io/deepagents-in-action/chapters/ch09-human-in-the-loop/)。用邮件草稿演示：Agent 提出工具调用 → checkpoint 保存状态并暂停 → Web 审批 → 同一 thread_id 恢复 → 展示结果。

## 运行

仓库根目录先执行 `bun install`，然后：

```sh
cd services/deepagents-in-action
bun run hitl:demo
```

打开 <http://127.0.0.1:2029>。一个后端同时提供 API 和静态 Web 页面，无需另外启动前端、数据库、Tavily 或第 6 章的 Agent Server。

免密钥模式使用固定的模型输出，但 **Deep Agents、工具调用、MemorySaver、interrupt 和 Command 恢复都真实运行**。邮件只写入会话的模拟发件箱，不发送真实邮件。

需要模型根据自然语言起草内容时，停止演示服务，再执行：

```sh
bun run hitl
```

自动读取上一章共用的 `services/deepagents-in-action/.env`：优先 `SILICONFLOW_API_KEY` + `MODEL_NAME`，否则使用 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`DEEPAGENT_MODEL` / `OPENAI_MODEL`。模型需支持工具调用。邮件仍然是模拟的。现有 LangSmith 环境变量适用，运行名称为 `ch09-human-in-the-loop`。

端口默认 2029，可在 `.env` 设置 `HITL_PORT=2030`。服务仅监听 `127.0.0.1`。

## 页面操作

1. **邮件审批**：发起任务，看到待审批邮件，此时发件箱应为 0。
2. 选择 **批准执行**，提交后发件箱增加一封；或 **修改后执行**，调整收件人、主题、正文后提交。
3. **拒绝执行**：填写原因，Agent 收到拒绝反馈，发件箱保持为空。
4. **批量审批**：一次检查两封邮件，每一项都必须选择决策。
5. **人工回答**：Agent 暂停提问，你填写答案，恢复后答案成为工具结果。
6. 在等待审批时刷新页面，仍能通过本地保存的会话 ID 读取待审批内容。重启服务后内存状态消失，需要开始新任务。

### 与 Python 教程的差异

- 当前锁定 `deepagents@1.10.2` 与其 `langchain@1.5.4`。JS 的 `interruptOn` 原生支持 `approve/edit/reject`。
- `respond` 并非当前版本原生决策。本例在 `ask_user` 工具中调用底层 `interrupt()`，Web 将这个人工回答操作标记为 `respond`，后端检查并将回答返回模型。没有把回答伪装成拒绝。
- 当前 JS 中间件在批次中遇到任意 `reject` 时跳回模型，同批获批调用也不执行。因此示例禁止混合批准与拒绝：可以全部批准/修改，或全部拒绝。如仅需部分邮件，全部拒绝后新建任务。
- JS 参数使用 `interruptOn`、`allowedDecisions`、`editedAction`；不照搬 Python `version="v2"` 和蛇形字段名。
- 锁文件让 Deep Agents 和 LangChain 使用同一 LangGraph 1.4.15，避免 `Command` 的类型与运行时版本分裂。

## 代码结构

| 文件 | 职责 |
| --- | --- |
| `agent.ts` | 模拟邮件工具、人工提问、审批策略、checkpointer、免密钥模型 |
| `sessions.ts` | 会话隔离、状态读取、审批校验、同线程恢复、并发与重复提交保护 |
| `server.ts` | 本地 HTTP API、模型配置、静态页面 |
| `web/` | 原生 HTML/CSS/JavaScript，展示状态、填写决策、轮询结果 |
| `sessions.test.ts` | 真正运行图的离线测试和 HTTP 集成测试 |

后端创建任务后立即返回 202，浏览器轮询状态。Agent 运行到审批点时返回控制权，后端保存中断 ID 与参数；浏览器提交决策后，用 `new Command({ resume: { [interruptId]: { decisions } } })` 和原 `thread_id` 恢复。审批按钮不是让模型重新理解“同意”二字，而是提交结构化的决策。

## API

| 方法与路径 | 用途 |
| --- | --- |
| `GET /api/config` | 模式信息，不返回密钥 |
| `POST /api/sessions` | `{ "prompt": "起草并发送邮件…" }` 创建任务 |
| `GET /api/sessions/:id` | 读取状态、消息、待审批操作、模拟发件箱 |
| `POST /api/sessions/:id/resume` | 提交审批版本及按中断分组的决策 |

```json
{
  "revision": 0,
  "reviews": [{
    "interruptId": "从 pending 获取的 ID",
    "decisions": [{ "type": "approve" }]
  }]
}
```

决策数量与顺序需匹配 `actionRequests`。编辑只能修改邮件参数，不能更换工具；后端会校验邮箱、必填内容与允许的决策。过期版本或重复提交返回 409。

## 验证与边界

```sh
bun run typecheck
bun test ch09-human-in-the-loop/sessions.test.ts
```

测试覆盖审批前无副作用、编辑参数后执行、拒绝不执行、批量批准、人工回答、重复提交、输入校验及跨站请求拦截。

这是本机单用户教学示例：无登录系统，最多保留 100 个内存会话；刷新保留会话 ID，不保存未提交的表单修改。生产使用需持久化 checkpointer、身份认证与审批权限、工具幂等和审计。中断恢复可能重放节点，所以不可把不可重复的外部操作放在 `interrupt()` 之前。

参考：[LangChain JS HITL](https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop)、[LangGraph JS Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)。实际支持以当前安装版本和测试为准。
