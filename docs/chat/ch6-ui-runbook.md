# 第六章 AI 驱动 UI — 联调 Runbook

手动验收 Ch6 `/api/ui-chat` 协议闭环。需先启动 chat 服务（默认 `http://localhost:4001`）并配置有效的 LLM（`OPENAI_API_KEY` / `OPENAI_BASE_URL`）。

**分支：** `feat/LangChain-Advanced-UI`  
**Spec：** [`docs/superpowers/specs/2026-08-04-langchain-ch6-ai-ui-design.md`](../superpowers/specs/2026-08-04-langchain-ch6-ai-ui-design.md)  
**Plan：** [`docs/superpowers/plans/2026-08-04-langchain-ch6-ai-ui.md`](../superpowers/plans/2026-08-04-langchain-ch6-ai-ui.md)

以下示例使用 bash + `curl`。Windows 可用 Git Bash 或 `curl.exe`（与 [`services/chat/scripts/ch5-smoke.ps1`](../../services/chat/scripts/ch5-smoke.ps1) 相同模式）。

```bash
export BASE=http://localhost:4001
export EMAIL="ch6-ui-$(date +%s)@example.com"
export PASS=SmokePass123!
```

---

## 0. 健康检查

```bash
curl -sS "$BASE/health"
```

---

## 1. 注册 / 登录

```bash
curl -sS -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Ch6 UI Smoke\"}"

curl -sS -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
```

从登录响应提取 JWT（字段名 **`accessToken`**）：

```bash
export TOKEN=$(curl -sS -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | jq -r .accessToken)
```

---

## 2. 创建会话

```bash
export CONV_ID=$(curl -sS -X POST "$BASE/api/conversations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Ch6 UI smoke"}' | jq -r .id)

echo "conversationId=$CONV_ID"
```

---

## 3. UI Chat — 发起需求

```bash
curl -sS -X POST "$BASE/api/ui-chat/$CONV_ID/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input":"我要提一个新需求"}' | jq .
```

**预期：** HTTP 200；响应为 `AIUIResponse`（`version: "1.0"`、`message`、`components[]`）。LLM 通常返回 `selection` 或 `form` 等组件。

---

## 4. UI Action — select / submit / confirm

根据上一步返回的 `components[0].type` 构造 action。以下为典型闭环示例（字段需与 LLM 实际返回对齐）。

### 4a. Selection（选择需求类型）

```bash
curl -sS -X POST "$BASE/api/ui-chat/$CONV_ID/action" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": {
      "componentType": "selection",
      "payload": { "type": "select", "selectedId": "functional" }
    }
  }' | jq .
```

### 4b. Form（填写需求详情）

```bash
curl -sS -X POST "$BASE/api/ui-chat/$CONV_ID/action" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": {
      "componentType": "form",
      "payload": {
        "type": "submit",
        "formData": {
          "title": "用户登录优化",
          "description": "支持 OAuth 与 MFA"
        }
      }
    }
  }' | jq .
```

### 4c. Confirmation（确认并开始分析）

```bash
curl -sS -X POST "$BASE/api/ui-chat/$CONV_ID/action" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": {
      "componentType": "confirmation",
      "payload": { "type": "confirm", "confirmed": true }
    }
  }' | jq .
```

**预期：** 响应含 `"streamSuggested": true`；**不**在此步调用 orchestrate。若 `confirmed: false`，应返回同步 LLM 下一步且无 `streamSuggested`。

---

## 5. Analyze Stream（SSE）

在收到 `streamSuggested: true` 后调用：

```bash
curl -sS -N -X POST "$BASE/api/ui-chat/$CONV_ID/analyze/stream" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"
```

**预期 SSE 事件顺序（`data: {...}` 行）：**

| messageType | 说明 |
| --- | --- |
| `progress` | 分析进度（可为占位） |
| `markdown` | 文本块（`payload.content`） |
| `ui` | 整批 UI 组件（`payload.components`） |
| `done` | 流结束 |

示例解析：

```bash
curl -sS -N -X POST "$BASE/api/ui-chat/$CONV_ID/analyze/stream" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream" \
| while read -r line; do
    case "$line" in
      data:*) echo "${line#data: }" | jq -c '.messageType' ;;
    esac
  done
```

应看到 `progress` → `markdown` → `ui` → `done`（顺序允许中间有多条 progress/markdown）。

---

## 6. 消息历史 — 验证 `metadata.ui`

```bash
curl -sS "$BASE/api/conversations/$CONV_ID/messages" \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.metadata.ui != null) | {role, metadata}'
```

**预期：** 存在 `role: "ai"` 的消息，其 `metadata.ui` 含完整 `AIUIResponse`（含 `components` 与可选 `context.collectedData`）。

---

## 7. 回归 — 旧版纯文本 Chat 仍可用

```bash
curl -sS -X POST "$BASE/api/conversations/$CONV_ID/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input":"用一句话总结刚才的需求"}' | jq .
```

**预期：** HTTP 200；走原有 `AnalyzeService` / orchestrate 路径，不受 UI 协议影响。

> 若 LLM 未配置，此步可能 5xx；与 Ch5 smoke 脚本一致，可视为环境限制而非协议回归失败。

---

## 8. 前端（可选）

```bash
# chat-web 默认 3002
cd clients/chat-web && bun dev
```

浏览器打开 `http://localhost:3002`，登录后走同一 JWT + 会话流程；确认 `ComponentRenderer` 渲染 selection/form/confirmation，confirm 后自动连 SSE。

---

## 单元测试

```bash
cd services/chat && bun test
```

覆盖 UI schema、adapter、action（confirm → streamSuggested）、controller 鉴权等。
