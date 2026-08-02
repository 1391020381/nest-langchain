# Ch3 LangChain API 使用流程速查 · Implementation Plan

> **For agentic workers:** Docs-only plan. Execute inline in this session.

**Goal:** 按已批准 spec，产出读者向速查页并归档到 `docs`，与第三章课本互链。

**Architecture:** Spec 保留在 `docs/superpowers/specs/`；读者向正文落入 `docs/AI Agents 开发实践/` 作为第三章附录；`learning-path.md` 与课本加入口链接。不改运行时代码。

**Tech Stack:** Markdown only

## Global Constraints

- 范围：LangChain 编程 API（不含 HTTP 路由清单）
- 内容以 `docs/superpowers/specs/2026-08-02-ch3-langchain-api-usage-flow-design.md` 为准
- 与仓库实现一致（含 `functionCalling`）

---

### Task 1: 读者向速查页

**Files:**
- Create: `docs/AI Agents 开发实践/5a-第三章附录：LangChain 编程 API 使用流程速查.md`
- Modify: `docs/superpowers/specs/2026-08-02-ch3-langchain-api-usage-flow-design.md`（§9 落地路径）
- Modify: `docs/AI Agents 开发实践/5-第三章：LangChain 起手——搭建第一条服务端能力链路.md`（文首互链）
- Modify: `docs/learning-path.md`（第三章行增加附录链接）

- [x] **Step 1:** 写入速查正文（分层对象卡 + API 表 + 主链串联 + 对象总览）
- [x] **Step 2:** 课本 / learning-path / spec §9 互链
- [x] **Step 3:** Commit 文档变更
