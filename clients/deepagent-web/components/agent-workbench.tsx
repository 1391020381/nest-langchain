"use client";

import type {
  AgentStreamEvent,
  AgentTodo,
} from "@autix/deepagent-contracts";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { streamAgentRun } from "@/lib/agent-api";

const EXAMPLE_REQUIREMENT =
  "作为企业管理员，我需要批量导入成员。单次最多 10,000 条，失败记录可下载，所有操作必须保留审计日志，并给出可执行的验收标准。";

type RunStatus = "idle" | "running" | "completed" | "failed";
type ProgressEvent = Extract<AgentStreamEvent, { type: "progress" }>;

function createThreadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function statusLabel(status: RunStatus): string {
  if (status === "running") return "分析进行中";
  if (status === "completed") return "分析已完成";
  if (status === "failed") return "运行遇到问题";
  return "等待开始";
}

function todoStatusLabel(status: AgentTodo["status"]): string {
  if (status === "completed") return "完成";
  if (status === "in_progress") return "进行中";
  return "待处理";
}

function shortThreadId(threadId: string): string {
  return threadId.length > 18 ? `${threadId.slice(0, 8)}…${threadId.slice(-6)}` : threadId;
}

export function AgentWorkbench() {
  const [input, setInput] = useState(EXAMPLE_REQUIREMENT);
  const [threadId, setThreadId] = useState("");
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [todos, setTodos] = useState<AgentTodo[]>([]);
  const [artifacts, setArtifacts] = useState<Record<string, string>>({});
  const [usedAgents, setUsedAgents] = useState<string[]>([]);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    setThreadId(createThreadId());
  }, []);

  const liveAgents = useMemo(() => {
    const names = new Set(usedAgents);
    for (const event of progress) names.add(event.agent);
    return [...names];
  }, [progress, usedAgents]);

  function resetOutput() {
    setProgress([]);
    setTodos([]);
    setArtifacts({});
    setUsedAgents([]);
    setReport("");
    setError("");
  }

  function applyEvent(event: AgentStreamEvent) {
    if (event.type === "run.started") {
      setThreadId(event.threadId);
      return;
    }
    if (event.type === "progress") {
      setProgress((current) => [...current, event]);
      return;
    }
    if (event.type === "artifact") {
      setArtifacts((current) => ({ ...current, [event.path]: event.content }));
      return;
    }
    if (event.type === "final") {
      setReport(event.report);
      setTodos(event.todos);
      setArtifacts(event.artifacts);
      setUsedAgents(event.usedAgents);
      return;
    }
    // error/done 只记录协议状态；等 reader.cancel()/releaseLock 完成后，
    // handleSubmit 再解锁页面，避免旧 run 收尾时启动新 run。
    if (event.type === "error") {
      setError(event.message);
      return;
    }
    if (event.type === "done") return;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requirement = input.trim();
    if (!requirement || runStatus === "running") return;

    resetOutput();
    setRunStatus("running");
    const activeThreadId = threadId || createThreadId();
    if (!threadId) setThreadId(activeThreadId);
    const controller = new AbortController();
    abortController.current = controller;
    let receivedFinal = false;
    let receivedDone = false;
    let receivedError = "";

    try {
      await streamAgentRun(
        { input: requirement, threadId: activeThreadId },
        {
          signal: controller.signal,
          onEvent: (streamEvent) => {
            if (streamEvent.type === "final") receivedFinal = true;
            if (streamEvent.type === "done") receivedDone = true;
            if (streamEvent.type === "error") receivedError = streamEvent.message;
            applyEvent(streamEvent);
          },
        },
      );
      if (receivedError) {
        setError(receivedError);
        setRunStatus("failed");
        return;
      }
      if (!receivedFinal || !receivedDone) {
        throw new Error("流式连接提前结束，请重新提交本次分析");
      }
      setRunStatus((current) => (current === "failed" ? current : "completed"));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setError("本次分析已取消。你可以修改需求后重新开始。");
      } else {
        setError(caught instanceof Error ? caught.message : "无法完成本次分析");
      }
      setRunStatus("failed");
    } finally {
      if (abortController.current === controller) {
        abortController.current = null;
      }
    }
  }

  function handleCancel() {
    abortController.current?.abort();
  }

  function handleNewThread() {
    if (runStatus === "running") return;
    setThreadId(createThreadId());
    setRunStatus("idle");
    resetOutput();
  }

  const artifactEntries = Object.entries(artifacts);

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">A</span>
          <div>
            <p className="eyebrow">AUTIX · DEEPAGENT-FIRST</p>
            <h1>需求分析工作台</h1>
          </div>
        </div>
        <div className={`run-state run-state--${runStatus}`} aria-live="polite">
          <span className="run-state__dot" aria-hidden="true" />
          {statusLabel(runStatus)}
        </div>
      </header>

      <section className="workspace-grid">
        <aside className="composer-card">
          <div className="section-heading">
            <div>
              <p className="step-label">01 · 输入</p>
              <h2>描述要分析的需求</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => setInput(EXAMPLE_REQUIREMENT)}
              disabled={runStatus === "running"}
            >
              使用示例
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="requirement-input">
              需求描述
            </label>
            <textarea
              id="requirement-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="写清用户、目标、约束和预期结果……"
              rows={11}
              maxLength={20_000}
              disabled={runStatus === "running"}
            />
            <div className="input-meta">
              <span>建议包含角色、边界与验收条件</span>
              <span>{input.length.toLocaleString("zh-CN")} / 20,000</span>
            </div>

            <div className="composer-actions">
              {runStatus === "running" ? (
                <button type="button" className="secondary-button" onClick={handleCancel}>
                  取消分析
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleNewThread}
                >
                  新建会话
                </button>
              )}
              <button
                type="submit"
                className="primary-button"
                disabled={!input.trim() || runStatus === "running"}
              >
                {runStatus === "running" ? "专家协作中…" : "开始 DeepAgent 分析"}
              </button>
            </div>
          </form>

          <div className="session-note">
            <span>会话</span>
            <code title={threadId}>{threadId ? shortThreadId(threadId) : "准备中"}</code>
          </div>
        </aside>

        <section className="results-column" aria-label="分析结果">
          {error ? (
            <div className="error-banner" role="alert">
              <strong>本次运行未完成</strong>
              <span>{error}</span>
            </div>
          ) : null}

          <section className="overview-card">
            <div className="section-heading">
              <div>
                <p className="step-label">02 · 协作</p>
                <h2>实时执行轨迹</h2>
              </div>
              <span className="metric-pill">{progress.length} 个事件</span>
            </div>

            {progress.length === 0 ? (
              <div className="empty-flow">
                <div className="empty-flow__rail" aria-hidden="true">
                  <span>规划</span><i /><span>委派</span><i /><span>汇总</span>
                </div>
                <p>提交需求后，这里会显示规划、工具调用与子 Agent 协作过程。</p>
              </div>
            ) : (
              <ol className="timeline">
                {progress.map((event, index) => (
                  <li key={`${event.timestamp}-${event.agent}-${event.tool ?? "agent"}-${index}`}>
                    <span
                      className={`timeline__marker timeline__marker--${event.status}`}
                      aria-hidden="true"
                    />
                    <div className="timeline__content">
                      <div>
                        <strong>{event.agent}</strong>
                        <span>
                          {event.tool ? `调用 ${event.tool}` : "执行任务"}
                          {event.message ? `：${event.message}` : ""}
                        </span>
                      </div>
                      <time dateTime={event.timestamp}>
                        {new Date(event.timestamp).toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="detail-grid">
            <section className="detail-card">
              <div className="detail-card__title">
                <h3>参与专家</h3>
                <span>{liveAgents.length}</span>
              </div>
              {liveAgents.length ? (
                <div className="agent-list">
                  {liveAgents.map((agent) => (
                    <span key={agent} className="agent-chip">{agent}</span>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">尚未委派子 Agent</p>
              )}
            </section>

            <section className="detail-card">
              <div className="detail-card__title">
                <h3>任务清单</h3>
                <span>{todos.length}</span>
              </div>
              {todos.length ? (
                <ul className="todo-list">
                  {todos.map((todo, index) => (
                    <li key={`${todo.content}-${index}`}>
                      <span className={`todo-status todo-status--${todo.status}`}>
                        {todoStatusLabel(todo.status)}
                      </span>
                      <span>{todo.content}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted-copy">任务规划将在最终状态中汇总</p>
              )}
            </section>
          </div>

          <section className="report-card">
            <div className="section-heading">
              <div>
                <p className="step-label">03 · 交付</p>
                <h2>Markdown 分析报告</h2>
              </div>
              {report ? <span className="success-badge">已生成</span> : null}
            </div>
            {report ? (
              <pre className="markdown-report">{report}</pre>
            ) : (
              <div className="report-placeholder">
                <span aria-hidden="true">MD</span>
                <p>DeepAgent 完成专家协作后，最终报告会显示在这里。</p>
              </div>
            )}
          </section>

          <section className="artifact-card">
            <div className="detail-card__title">
              <h3>工作产物</h3>
              <span>{artifactEntries.length}</span>
            </div>
            {artifactEntries.length ? (
              <div className="artifact-list">
                {artifactEntries.map(([path, content]) => (
                  <details key={path}>
                    <summary>
                      <code>{path}</code>
                      <span>{content.length.toLocaleString("zh-CN")} 字符</span>
                    </summary>
                    <pre>{content}</pre>
                  </details>
                ))}
              </div>
            ) : (
              <p className="muted-copy">虚拟文件系统中的中间产物将在这里归档。</p>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}
