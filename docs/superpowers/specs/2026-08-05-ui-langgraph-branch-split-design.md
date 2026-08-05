# Design: UI / LangGraph 分支拆分

**Date:** 2026-08-05  
**Status:** Approved for implementation planning  
**Branch (at authoring):** `feat/LangChain-Advanced-UI`（拆分后本文件随 LangGraph tip 保留在 `feat/LangChain-LangGraph`）  
**Related:** Ch6 UI on `feat/LangChain-Advanced-UI`；Ch8/9 LangGraph learning service

## Goal

把误叠在 UI 分支上的 LangGraph 工作挪到独立分支，使：

1. `feat/LangChain-Advanced-UI` 只保留第六章 AI 驱动 UI（tip = `a4e0cf8`）。
2. `feat/LangChain-LangGraph` = 清理后的 UI 基线 + 已有 LangGraph 两 commit（当前 tip `3556afb` 及其父 `848b0e1`）。
3. 远程同步：UI 使用 `--force-with-lease`；新分支普通 push。

## Context

- 当前分支：`feat/LangChain-Advanced-UI`（已与 `origin` 同步）。
- LangGraph 已提交在 UI tip 之上：
  - `848b0e1` — `feat(langgraph): add LangGraph learning service with HITL graphs`
  - `3556afb` — `docs(langgraph): add core concepts and usage workflow guide`
- 最后一个纯 UI commit：`a4e0cf8` — `fix(chat): harden ui-chat SSE 404, fallback privacy, and stream client`
- `feat/LangChain-LangGraph` 尚不存在。
- 仓库内仅本人使用 UI 远程分支，可安全 force-with-lease。
- `services/langGraph` 设计为独立学习服务，不侵入 `services/chat` / `services/api`。

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| 目标 | UI 分支变干净（选项 A） |
| 清理方式 | 改写历史：UI hard reset 到 `a4e0cf8` + force-with-lease |
| LangGraph 基线 | 从清理后的 UI tip 叠出（含完整 Ch6） |
| 执行手法 | 方案 1「先留后裁」：先建 LangGraph 分支保住 tip，再 reset UI |
| 协作 | 仅本人；可 force-with-lease |
| 不做 | revert 清理、interactive rebase、把 LangGraph 合回 UI（除非日后明确要求） |

## Branch topology (after)

```text
… → Ch5 Database (b917d57)
         └─ Ch6 UI … → a4e0cf8   ← feat/LangChain-Advanced-UI
                              ├─ 848b0e1 services/langGraph
                              └─ 3556afb docs/LangGraph/…  ← feat/LangChain-LangGraph
```

### Boundaries

| Branch | Owns | Does not own |
|--------|------|--------------|
| `feat/LangChain-Advanced-UI` | `services/chat` ui-protocol、`clients/chat-web` AI UI、Ch6 runbook/spec/plan | `services/langGraph`、根 `demo:langgraph` / `test:langgraph`、`docs/LangGraph/` |
| `feat/LangChain-LangGraph` | 上述 UI 基线 + `services/langGraph` + LangGraph 文档 + 根脚本 | 不把图编排能力反向塞进 UI 分支 |

## Procedure

### Preconditions

1. 工作区干净，或已 stash / 丢弃无关改动。
2. 已知本地可能有 `clients/chat-web/.env.example` 未提交修改：执行前 stash（若仍需要）或丢弃。
3. 确认 tip 仍为 `3556afb`（或等价：含上述两 LangGraph commit，且其下为 `a4e0cf8`）。若 tip 已前进，先更新本 spec 中的 hash 再执行。

### Steps（方案 1）

```bash
# 在 feat/LangChain-Advanced-UI、工作区干净时：

# 1) 保住当前 tip（含 LangGraph）
git branch feat/LangChain-LangGraph

# 2) UI 回退到最后一个纯 UI commit
git checkout feat/LangChain-Advanced-UI
git reset --hard a4e0cf8

# 3) 同步远程
git push --force-with-lease origin feat/LangChain-Advanced-UI
git push -u origin feat/LangChain-LangGraph
```

### Verification

**UI branch (`feat/LangChain-Advanced-UI`)**

- `git rev-parse HEAD` == `a4e0cf8`
- 无 `services/langGraph/`
- 根 `package.json` 无 `demo:langgraph` / `test:langgraph`
- 无 `docs/LangGraph/LangGraph核心知识点与常用使用流程.md`（该文件属于 LangGraph commit）

**LangGraph branch (`feat/LangChain-LangGraph`)**

- 包含完整 Ch6 UI 历史至 `a4e0cf8`
- 包含 `848b0e1` 与 `3556afb`（及本设计 commit，若拆分前已提交）
- `bun run test:langgraph` 通过

### Failure handling

| Situation | Action |
|-----------|--------|
| `--force-with-lease` 拒绝 | `git fetch`；确认无人推送后，再决定是否重试 |
| reset 后 tip 不对 / 丢 tip | `git reflog` 找回原 tip（曾为 `3556afb`），重新 `git branch -f feat/LangChain-LangGraph <tip>` |
| 工作区未清理就 hard reset | 先恢复 stash；不要用 reset 当「清脏」的唯一手段 |

## Documentation updates (post-split)

| File | Change | Branch to edit on |
|------|--------|-------------------|
| `docs/learning-path.md` | 第八/九章本仓对照改为 `feat/LangChain-LangGraph`；第六章仍为 `feat/LangChain-Advanced-UI` | 优先在 `feat/LangChain-LangGraph` 更新；UI 分支仅需保证 Ch6 指针不被误改 |
| `docs/chat/ch6-ui-runbook.md` | 保持 `feat/LangChain-Advanced-UI`，不混入 LangGraph | UI |
| `services/langGraph/README.md` | 注明所属分支 `feat/LangChain-LangGraph` | LangGraph |

官方对照分支 [Cookieboty/autix-demo `feat/LangGraph`](https://github.com/Cookieboty/autix-demo/tree/feat/LangGraph) 仍可作为只读参考；本仓实现分支名为 `feat/LangChain-LangGraph`。

## Ongoing workflow

1. 继续打磨 Ch6 → 只在 `feat/LangChain-Advanced-UI`。
2. 继续 Ch8/9 → 只在 `feat/LangChain-LangGraph`。
3. 若 UI 后续有修复且 LangGraph 需要：`merge` 或 `rebase` **UI → LangGraph**；不要把 `services/langGraph` 合回 UI，直到明确要做「UI + 图」一体化交付。

## Out of scope

- 实现新的 LangGraph 功能或改造 `services/chat` 接入图编排
- 合并 UI / LangGraph 到 `main`
- 改写 Ch6/Ch8 课本章节正文
- Database / Advanced 等更早分支的整理

## Success criteria

- [ ] 远程 `feat/LangChain-Advanced-UI` tip 为 `a4e0cf8`，无 LangGraph 文件
- [ ] 远程 `feat/LangChain-LangGraph` 存在且含 UI + LangGraph commits
- [ ] `learning-path.md`（及约定 README）已指向正确本仓分支名
- [ ] `bun run test:langgraph` 在 LangGraph 分支通过
