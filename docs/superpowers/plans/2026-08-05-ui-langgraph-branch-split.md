# UI / LangGraph Branch Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把叠在 `feat/LangChain-Advanced-UI` 上的 LangGraph commit 挪到独立分支 `feat/LangChain-LangGraph`，UI 分支 tip 回到纯 Ch6。

**Architecture:** 方案 1「先留后裁」——用新分支名钉住当前 tip，再把 UI hard reset 到 `a4e0cf8`，随后 force-with-lease UI、push 新分支，最后在 LangGraph 分支更新文档指针。

**Tech Stack:** Git、Bun workspaces、本仓已有 `services/langGraph`（不新增应用代码）

**Spec:** `docs/superpowers/specs/2026-08-05-ui-langgraph-branch-split-design.md`

## Global Constraints

- Spec hash 锚点（若 tip 已前进，先对照 `git log` 更新本 plan 再执行）：
  - 纯 UI tip：`a4e0cf8`（`fix(chat): harden ui-chat SSE 404, fallback privacy, and stream client`）
  - LangGraph 服务：`848b0e1`
  - LangGraph 文档：`3556afb`
  - 拆分设计 spec：`6100300`（及本 plan 提交后的更新 tip）
- 清理方式：hard reset + `git push --force-with-lease`（禁止裸 `--force`；禁止 revert 清理）
- LangGraph 基线：含完整 Ch6 UI（从清理后的 UI tip 叠出）
- 协作：仅本人使用 UI 远程分支
- 不做：interactive rebase、把 `services/langGraph` 合回 UI、改课本章正文、合并到 `main`
- Shell：Windows PowerShell；下列命令可直接在仓库根目录执行
- 危险操作前必须工作区干净（或已 stash）

---

## File Structure (locked)

本计划以 **Git 分支手术 + 文档指针** 为主，不新增业务模块。

| Path | Responsibility |
|------|----------------|
| （无新建源码） | LangGraph 代码已在 `848b0e1` |
| `docs/learning-path.md` | 第八/九章本仓分支指针改为 `feat/LangChain-LangGraph` |
| `services/langGraph/README.md` | 注明所属本仓分支 |
| `docs/chat/ch6-ui-runbook.md` | 只读验收：仍指向 `feat/LangChain-Advanced-UI` |
| `docs/superpowers/plans/2026-08-05-ui-langgraph-branch-split.md` | 本计划（拆分前 commit，随 LangGraph tip 保留） |
| `docs/superpowers/specs/2026-08-05-ui-langgraph-branch-split-design.md` | 已批准设计（已在 `6100300`） |

**拆分后拓扑：**

```text
… → a4e0cf8   ← feat/LangChain-Advanced-UI
         ├─ 848b0e1 services/langGraph
         ├─ 3556afb docs/LangGraph/…
         ├─ 6100300 design spec
         └─ <plan commit>  ← feat/LangChain-LangGraph
```

---

### Task 1: Preflight — 工作区与 tip 校验

**Files:**
- Read: `git` state only（不改文件）
- Possibly stash: `clients/chat-web/.env.example`

**Interfaces:**
- Consumes: 无
- Produces: 干净工作区；记下 `LANGGRAPH_TIP`（当前 HEAD 完整 hash）供后续任务使用

- [ ] **Step 1: 确认当前分支与脏文件**

Run:

```powershell
git status -sb
git branch --show-current
```

Expected:
- 当前分支：`feat/LangChain-Advanced-UI`
- 若出现 `M clients/chat-web/.env.example` 或其他未提交改动 → 进入 Step 2；若干净 → 跳到 Step 3

- [ ] **Step 2: 处理未提交改动（二选一）**

若还需要 `.env.example` 改动：

```powershell
git stash push -u -m "pre-branch-split" -- clients/chat-web/.env.example
```

若不需要：

```powershell
git restore clients/chat-web/.env.example
```

对其余未提交文件同样 stash 或 restore，直到 `git status -sb` 无 `M` / `??`（本 plan / spec 若尚未 commit，先完成 Task 1 Step 4 的 commit，或 stash 掉再继续）。

- [ ] **Step 3: 校验历史锚点**

Run:

```powershell
git rev-parse HEAD
git merge-base --is-ancestor a4e0cf8 HEAD; echo "exit=$LASTEXITCODE"
git merge-base --is-ancestor 848b0e1 HEAD; echo "exit=$LASTEXITCODE"
git merge-base --is-ancestor 3556afb HEAD; echo "exit=$LASTEXITCODE"
git log --oneline -5
```

Expected:
- `a4e0cf8`、`848b0e1`、`3556afb` 均为 `HEAD` 的祖先（`exit=0`）
- `git log` 中能看到 LangGraph 两 commit 与 `6100300`（design）
- 若 `HEAD` 不是 `6100300` 而是更新 tip：只要上述祖先关系成立即可；把完整 `HEAD` 记为 `LANGGRAPH_TIP`

- [ ] **Step 4: 提交本 plan（若尚未入库）**

Run:

```powershell
git status -sb
```

若 `docs/superpowers/plans/2026-08-05-ui-langgraph-branch-split.md` 为未跟踪/未提交：

```powershell
git add docs/superpowers/plans/2026-08-05-ui-langgraph-branch-split.md
git commit -m "docs(plans): add UI/LangGraph branch split plan"
git rev-parse HEAD
```

Expected: 新 commit 成功；将该 hash 记为 `LANGGRAPH_TIP`。

若该文件已在 HEAD 中：跳过 commit，`LANGGRAPH_TIP=$(git rev-parse HEAD)`。

- [ ] **Step 5: Preflight 通过门禁**

Run:

```powershell
git status -sb
git rev-parse HEAD
```

Expected:
- 工作区干净（允许 `## feat/LangChain-Advanced-UI...origin/... [ahead N]`）
- 打印出的 HEAD 即为后续要钉住的 `LANGGRAPH_TIP`

---

### Task 2: 创建 `feat/LangChain-LangGraph` 并裁剪 UI 分支

**Files:**
- Git refs only：`refs/heads/feat/LangChain-LangGraph`、`refs/heads/feat/LangChain-Advanced-UI`

**Interfaces:**
- Consumes: Task 1 的干净工作区与 `LANGGRAPH_TIP`
- Produces: 本地 `feat/LangChain-LangGraph` → `LANGGRAPH_TIP`；本地 `feat/LangChain-Advanced-UI` → `a4e0cf8`

- [ ] **Step 1: 钉住 LangGraph tip（先留）**

Run:

```powershell
git branch feat/LangChain-LangGraph
git rev-parse feat/LangChain-LangGraph
git rev-parse HEAD
```

Expected: 两个 `rev-parse` 输出相同，且等于 Task 1 的 `LANGGRAPH_TIP`。

若分支已存在且指向错误 tip：

```powershell
git branch -f feat/LangChain-LangGraph HEAD
```

- [ ] **Step 2: UI hard reset（后裁）**

Run:

```powershell
git checkout feat/LangChain-Advanced-UI
git reset --hard a4e0cf8
git rev-parse HEAD
git log --oneline -3
```

Expected:
- `HEAD` == `a4e0cf8`
- 最近 log **不含** `feat(langgraph)` / `docs(langgraph)` / branch-split design/plan

- [ ] **Step 3: 验收 UI 工作树无 LangGraph 产物**

Run:

```powershell
Test-Path services/langGraph
Test-Path "docs/LangGraph/LangGraph核心知识点与常用使用流程.md"
Select-String -Path package.json -Pattern "demo:langgraph|test:langgraph" -SimpleMatch
git merge-base --is-ancestor 848b0e1 HEAD; echo "langgraph_service_ancestor_exit=$LASTEXITCODE"
```

Expected:
- `Test-Path services/langGraph` → `False`
- LangGraph 文档路径 → `False`
- `Select-String` 无匹配（无输出）
- `langgraph_service_ancestor_exit=1`（`848b0e1` 不再是 UI HEAD 祖先）

- [ ] **Step 4: 验收 LangGraph 分支仍完整**

Run:

```powershell
git log --oneline -5 feat/LangChain-LangGraph
git merge-base --is-ancestor a4e0cf8 feat/LangChain-LangGraph; echo "ui_base_exit=$LASTEXITCODE"
git merge-base --is-ancestor 848b0e1 feat/LangChain-LangGraph; echo "lg_svc_exit=$LASTEXITCODE"
git merge-base --is-ancestor 3556afb feat/LangChain-LangGraph; echo "lg_docs_exit=$LASTEXITCODE"
```

Expected: 三个 `*_exit=0`；log 含 UI fix、langgraph feat/docs、design/plan。

- [ ] **Step 5: 本地拆分检查点（不 push）**

无需 commit（纯 ref 移动）。记录：

```text
UI HEAD = a4e0cf8
LangGraph HEAD = <LANGGRAPH_TIP>
```

若 Step 3/4 任一失败：停止，用 `git reflog` 找回原 tip，`git branch -f feat/LangChain-LangGraph <tip>`，**不要** push。

---

### Task 3: 同步远程分支

**Files:**
- Remote refs：`origin/feat/LangChain-Advanced-UI`、`origin/feat/LangChain-LangGraph`

**Interfaces:**
- Consumes: Task 2 本地两分支 tip
- Produces: 远程与本地一致

- [ ] **Step 1: fetch 并确认 lease 前提**

Run:

```powershell
git fetch origin
git rev-parse feat/LangChain-Advanced-UI
git rev-parse origin/feat/LangChain-Advanced-UI
git rev-parse feat/LangChain-LangGraph
```

Expected:
- 本地 UI = `a4e0cf8`
- `origin/feat/LangChain-Advanced-UI` 仍指向旧 tip（含 LangGraph）属正常，下一步 force-with-lease 会改写
- 本地已有 `feat/LangChain-LangGraph`

- [ ] **Step 2: force-with-lease 推送 UI**

Run:

```powershell
git push --force-with-lease origin feat/LangChain-Advanced-UI
```

Expected: 成功（`forced update` / `a4e0cf8` 出现在输出中）。

若失败（someone else pushed）：

```powershell
git fetch origin
git log --oneline origin/feat/LangChain-Advanced-UI -5
```

停止并人工确认；**不要**改用 `--force`。

- [ ] **Step 3: 推送新 LangGraph 分支**

Run:

```powershell
git push -u origin feat/LangChain-LangGraph
```

Expected: 新远程分支创建；upstream 已设置。

- [ ] **Step 4: 远程验收**

Run:

```powershell
git fetch origin
git rev-parse origin/feat/LangChain-Advanced-UI
git rev-parse origin/feat/LangChain-LangGraph
git merge-base --is-ancestor 848b0e1 origin/feat/LangChain-Advanced-UI; echo "ui_has_lg_exit=$LASTEXITCODE"
git merge-base --is-ancestor 848b0e1 origin/feat/LangChain-LangGraph; echo "lg_has_lg_exit=$LASTEXITCODE"
```

Expected:
- `origin/feat/LangChain-Advanced-UI` == `a4e0cf8`
- `origin/feat/LangChain-LangGraph` == 本地 `feat/LangChain-LangGraph`
- `ui_has_lg_exit=1`
- `lg_has_lg_exit=0`

---

### Task 4: 在 LangGraph 分支更新文档指针

**Files:**
- Modify: `docs/learning-path.md`（第八章、第九章表格行）
- Modify: `services/langGraph/README.md`（文首增加本仓分支说明）
- Verify only: `docs/chat/ch6-ui-runbook.md`（应仍写 `feat/LangChain-Advanced-UI`）

**Interfaces:**
- Consumes: 远程已存在的 `feat/LangChain-LangGraph`
- Produces: 文档指向本仓 `feat/LangChain-LangGraph`；官方 `feat/LangGraph` 仍作对照

- [ ] **Step 1: 切换到 LangGraph 分支**

Run:

```powershell
git checkout feat/LangChain-LangGraph
git status -sb
Test-Path services/langGraph
```

Expected: 在 `feat/LangChain-LangGraph`；`services/langGraph` 存在。

- [ ] **Step 2: 改 `docs/learning-path.md` 第八/九章对照列**

将表格中这两行：

```markdown
| [ ] | 第八章 | [10-第八章](./AI%20Agents%20开发实践/10-第八章：LangGraph%20单%20Agent%20图实战——路由、循环与质量闭环.md) | [feat/LangGraph](https://github.com/Cookieboty/autix-demo/tree/feat/LangGraph) |
| [ ] | 第九章 | [11-第九章](./AI%20Agents%20开发实践/11-第九章：LangGraph%20Multi-Agent%20实战.md) | [feat/LangGraph](https://github.com/Cookieboty/autix-demo/tree/feat/LangGraph) |
```

替换为：

```markdown
| [ ] | 第八章 | [10-第八章](./AI%20Agents%20开发实践/10-第八章：LangGraph%20单%20Agent%20图实战——路由、循环与质量闭环.md) | 本仓 `feat/LangChain-LangGraph` · 官方对照 [feat/LangGraph](https://github.com/Cookieboty/autix-demo/tree/feat/LangGraph) |
| [ ] | 第九章 | [11-第九章](./AI%20Agents%20开发实践/11-第九章：LangGraph%20Multi-Agent%20实战.md) | 本仓 `feat/LangChain-LangGraph` · 官方对照 [feat/LangGraph](https://github.com/Cookieboty/autix-demo/tree/feat/LangGraph) |
```

确认第六章行仍为：

```markdown
本仓 `feat/LangChain-Advanced-UI`
```

- [ ] **Step 3: 改 `services/langGraph/README.md` 文首**

在标题 `# LangGraph 学习服务` 之后、第一段之前插入：

```markdown
**本仓分支：** `feat/LangChain-LangGraph`（与 `feat/LangChain-Advanced-UI` 分离；官方对照 [autix-demo feat/LangGraph](https://github.com/Cookieboty/autix-demo/tree/feat/LangGraph)）
```

- [ ] **Step 4: 只读核对 Ch6 runbook**

Run:

```powershell
Select-String -Path docs/chat/ch6-ui-runbook.md -Pattern "feat/LangChain-Advanced-UI"
Select-String -Path docs/chat/ch6-ui-runbook.md -Pattern "feat/LangChain-LangGraph"
```

Expected: 第一行有匹配；第二行无匹配。若误写了 LangGraph，改回 UI 分支名（在 **UI 分支** 上改，本任务不要把 runbook 改成 LangGraph）。

- [ ] **Step 5: 跑 LangGraph 测试**

Run:

```powershell
bun run test:langgraph
```

Expected: 测试通过（exit 0）。若因依赖未安装失败：

```powershell
bun install
bun run test:langgraph
```

- [ ] **Step 6: Commit 并推送文档**

```powershell
git add docs/learning-path.md services/langGraph/README.md
git commit -m "docs(langgraph): point learning-path and README at feat/LangChain-LangGraph"
git push origin feat/LangChain-LangGraph
```

Expected: push 成功；`origin/feat/LangChain-LangGraph` 前进 1 commit。

---

### Task 5: 端到端验收清单

**Files:**
- 无代码改动；只读校验

**Interfaces:**
- Consumes: Task 3–4 完成后的远程状态
- Produces: spec Success criteria 全部勾选

- [ ] **Step 1: UI 远程干净**

```powershell
git fetch origin
git rev-parse origin/feat/LangChain-Advanced-UI
git ls-tree -d --name-only origin/feat/LangChain-Advanced-UI:services
git show origin/feat/LangChain-Advanced-UI:package.json | Select-String "langgraph"
```

Expected:
- hash = `a4e0cf8`
- `services` 列表**不含** `langGraph`
- `package.json` 无 `langgraph` 脚本行

- [ ] **Step 2: LangGraph 远程完整**

```powershell
git log --oneline origin/feat/LangChain-LangGraph -8
git cat-file -e origin/feat/LangChain-LangGraph:services/langGraph/package.json; echo "pkg_exit=$LASTEXITCODE"
```

Expected: log 含 `a4e0cf8` 之后的 langgraph/docs/design/plan/docs-pointer；`pkg_exit=0`。

- [ ] **Step 3: 文档指针**

```powershell
git show origin/feat/LangChain-LangGraph:docs/learning-path.md | Select-String "feat/LangChain-LangGraph"
git show origin/feat/LangChain-Advanced-UI:docs/chat/ch6-ui-runbook.md | Select-String "feat/LangChain-Advanced-UI"
```

Expected: LangGraph 的 learning-path 含本仓分支名；UI 的 runbook 仍指向 UI 分支。

- [ ] **Step 4: 勾选 spec 成功标准**

打开 `docs/superpowers/specs/2026-08-05-ui-langgraph-branch-split-design.md`，确认以下均已满足（可在 LangGraph 分支另开小 commit 勾选，或仅口头确认）：

- [x] 远程 `feat/LangChain-Advanced-UI` tip 为 `a4e0cf8`，无 LangGraph 文件
- [x] 远程 `feat/LangChain-LangGraph` 存在且含 UI + LangGraph commits
- [x] `learning-path.md`（及 README）已指向正确本仓分支名
- [x] `bun run test:langgraph` 在 LangGraph 分支通过

- [ ] **Step 5: 恢复工作习惯提醒（不写代码）**

告知执行者后续约定（无需 commit）：

1. 打磨 Ch6 → `git checkout feat/LangChain-Advanced-UI`
2. 做 Ch8/9 → `git checkout feat/LangChain-LangGraph`
3. UI 修复需要同步时：在 LangGraph 上 `git merge feat/LangChain-Advanced-UI`（或 rebase），不要反向把图服务合进 UI
4. 若 Task 1 stash 过 `.env.example`：在合适分支 `git stash pop`

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| UI tip = `a4e0cf8` | Task 2, 3, 5 |
| LangGraph = UI + `848b0e1` + `3556afb`（+ design/plan） | Task 1–3, 5 |
| force-with-lease UI；普通 push LangGraph | Task 3 |
| 先留后裁 | Task 2 Step 1→2 |
| 工作区 / `.env.example` 前置 | Task 1 |
| learning-path / README / runbook 核对 | Task 4 |
| `bun run test:langgraph` | Task 4 Step 5, Task 5 |
| 失败处理（lease / reflog） | Task 2 Step 5, Task 3 Step 2 |
| 不做 revert / 不合回 UI / 不改课本 | Global Constraints |
| Ongoing workflow 提醒 | Task 5 Step 5 |
