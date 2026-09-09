"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgentRunStatus,
  AgentStreamEvent,
  LiveHealthResponse,
  ModelDiagnosticResponse,
  ReadinessResponse,
  RequirementArtifact,
  RequirementTodo,
} from "@autix/requirement-deepagent-contracts";
import {
  diagnoseModel,
  formatApiError,
  getLiveness,
  getReadiness,
  streamRequirementAnalysis,
} from "@/lib/api";

const EXAMPLE_REQUIREMENT =
  "作为企业管理员，我需要批量导入 Excel 成员数据，单次最多 10,000 行；校验失败的记录可以下载；所有导入操作必须保留审计日志。";

type AsyncState<T> =
  | { phase: "loading" }
  | { phase: "success"; data: T }
  | { phase: "error"; message: string };
type PageRunState = "idle" | "running" | AgentRunStatus;

function eventTitle(event: AgentStreamEvent): string {
  if (event.type === "run.started") return "运行已开始";
  if (event.type === "plan.updated") return `计划已更新 · ${event.todos.length} 项`;
  if (event.type === "agent.progress") return `${event.agent} · ${event.status}`;
  if (event.type === "tool.progress") {
    return `${event.agent} / ${event.tool} · ${event.status}`;
  }
  if (event.type === "artifact.available") {
    return `产物已导出 · ${event.artifact.path}`;
  }
  if (event.type === "report.completed") return "分析报告已完成";
  if (event.type === "run.error") return `${event.code} · ${event.message}`;
  if (event.type === "run.cancelled") return event.message;
  return `运行结束 · ${event.status}`;
}

function eventDetail(event: AgentStreamEvent): string | undefined {
  return event.type === "agent.progress" || event.type === "tool.progress"
    ? event.message
    : undefined;
}

export default function RequirementWorkbench() {
  const [live, setLive] = useState<AsyncState<LiveHealthResponse>>({ phase: "loading" });
  const [ready, setReady] = useState<AsyncState<ReadinessResponse>>({ phase: "loading" });
  const [diagnostic, setDiagnostic] =
    useState<AsyncState<ModelDiagnosticResponse> | null>(null);
  const [input, setInput] = useState(EXAMPLE_REQUIREMENT);
  const [runState, setRunState] = useState<PageRunState>("idle");
  const [events, setEvents] = useState<AgentStreamEvent[]>([]);
  const [todos, setTodos] = useState<RequirementTodo[]>([]);
  const [artifacts, setArtifacts] = useState<RequirementArtifact[]>([]);
  const [report, setReport] = useState("");
  const [runError, setRunError] = useState("");
  const [threadId, setThreadId] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const refreshHealth = useCallback(async () => {
    const [liveResult, readyResult] = await Promise.allSettled([
      getLiveness(),
      getReadiness(),
    ]);
    setLive(
      liveResult.status === "fulfilled"
        ? { phase: "success", data: liveResult.value }
        : { phase: "error", message: formatApiError(liveResult.reason) },
    );
    setReady(
      readyResult.status === "fulfilled"
        ? { phase: "success", data: readyResult.value }
        : { phase: "error", message: formatApiError(readyResult.reason) },
    );
  }, []);

  useEffect(() => {
    void refreshHealth();
    return () => abortRef.current?.abort();
  }, [refreshHealth]);

  async function runDiagnostic() {
    setDiagnostic({ phase: "loading" });
    try {
      setDiagnostic({ phase: "success", data: await diagnoseModel() });
    } catch (error) {
      setDiagnostic({ phase: "error", message: formatApiError(error) });
    }
  }

  function consumeEvent(event: AgentStreamEvent) {
    setEvents((current) => [...current, event]);
    setThreadId(event.threadId);
    if (event.type === "plan.updated") setTodos(event.todos);
    if (event.type === "artifact.available") {
      setArtifacts((current) => [
        ...current.filter((artifact) => artifact.path !== event.artifact.path),
        event.artifact,
      ]);
    }
    if (event.type === "report.completed") {
      setReport(event.report);
      setTodos(event.todos);
      setArtifacts(event.artifacts);
    }
    if (event.type === "run.error") setRunError(event.message);
    if (event.type === "run.done") setRunState(event.status);
  }

  async function startAnalysis() {
    const normalized = input.trim();
    if (!normalized || runState === "running") return;
    const controller = new AbortController();
    abortRef.current = controller;
    const nextThreadId = `thread-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setThreadId(nextThreadId);
    setRunState("running");
    setEvents([]);
    setTodos([]);
    setArtifacts([]);
    setReport("");
    setRunError("");

    try {
      await streamRequirementAnalysis(
        { input: normalized, threadId: nextThreadId },
        { signal: controller.signal, onEvent: consumeEvent },
      );
    } catch (error) {
      if (controller.signal.aborted) setRunState("cancelled");
      else {
        setRunState("failed");
        setRunError(formatApiError(error));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function cancelAnalysis() {
    abortRef.current?.abort();
    setRunState("cancelled");
  }

  const apiAlive = live.phase === "success" && live.data.status === "alive";
  const configReady = ready.phase === "success" && ready.data.status === "ready";
  const modelReady = diagnostic?.phase === "success" && diagnostic.data.status === "ready";

  return (
    <main>
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <section className="shell workbenchShell">
        <header className="mvpTopbar">
          <div className="mvpBrandBlock">
            <span className="brandMark">DA</span>
            <div>
              <p className="eyebrow">DEEPAGENT · REQUIREMENT PLATFORM</p>
              <h1>单需求分析工作台</h1>
            </div>
          </div>
          <div className="systemChecks" aria-label="系统状态">
            <span className={apiAlive ? "systemPill good" : "systemPill"}>
              API {apiAlive ? "正常" : "未连接"}
            </span>
            <span className={configReady ? "systemPill good" : "systemPill"}>
              配置 {configReady ? "就绪" : "待处理"}
            </span>
            <button
              className={modelReady ? "systemPill good" : "systemPill buttonPill"}
              disabled={diagnostic?.phase === "loading" || !apiAlive}
              onClick={() => void runDiagnostic()}
            >
              {diagnostic?.phase === "loading"
                ? "模型检查中"
                : modelReady
                  ? "模型已验证"
                  : "检查模型"}
            </button>
          </div>
        </header>

        {runError && <div className="errorBanner">{runError}</div>}

        <section className="mvpWorkbench">
          <article className="mvpPanel inputPanel">
            <p className="stepLabel">01 · 输入</p>
            <h2>描述一条完整需求</h2>
            <textarea
              value={input}
              maxLength={20_000}
              disabled={runState === "running"}
              onChange={(event) => setInput(event.target.value)}
              aria-label="待分析需求"
            />
            <div className="inputMeta">
              <span>建议包含角色、边界与验收条件</span>
              <span>{input.length.toLocaleString()} / 20,000</span>
            </div>
            <div className="actionRow">
              <button
                className="secondaryButton"
                disabled={runState === "running"}
                onClick={() => setInput(EXAMPLE_REQUIREMENT)}
              >
                使用示例
              </button>
              {runState === "running" ? (
                <button className="dangerButton" onClick={cancelAnalysis}>取消分析</button>
              ) : (
                <button
                  className="primaryButton"
                  disabled={!input.trim() || !apiAlive}
                  onClick={() => void startAnalysis()}
                >
                  开始 DeepAgent 分析
                </button>
              )}
            </div>
            <div className="runIdentity">
              <span>状态</span><strong>{runState}</strong>
              <span>会话</span><code>{threadId || "尚未创建"}</code>
            </div>
          </article>

          <article className="mvpPanel tracePanel">
            <div className="panelHeading">
              <div><p className="stepLabel">02 · 协作</p><h2>实时执行轨迹</h2></div>
              <span className="counter">{events.length} 个事件</span>
            </div>
            {events.length === 0 ? (
              <div className="emptyState">提交需求后，这里会显示规划、Agent 委派和工具执行。</div>
            ) : (
              <ol className="timeline">
                {events.slice(-60).map((event) => (
                  <li key={`${event.runId}-${event.sequence}`}>
                    <span className={`eventDot ${event.type.replaceAll(".", "-")}`} />
                    <div>
                      <strong>{eventTitle(event)}</strong>
                      {eventDetail(event) && <p>{eventDetail(event)}</p>}
                    </div>
                    <time>#{event.sequence}</time>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </section>

        <section className="resultGrid">
          <article className="mvpPanel todoPanel">
            <div className="panelHeading compactHeading"><h2>任务计划</h2><span className="counter">{todos.length}</span></div>
            {todos.length === 0 ? <p className="muted">Root Agent 尚未调用 write_todos。</p> : (
              <ul className="todoList">
                {todos.map((todo, index) => (
                  <li key={`${todo.content}-${index}`}>
                    <span className={`todoStatus ${todo.status}`} />
                    <span>{todo.content}</span><small>{todo.status}</small>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="mvpPanel artifactPanel">
            <div className="panelHeading compactHeading"><h2>本次产物</h2><span className="counter">{artifacts.length}</span></div>
            {artifacts.length === 0 ? <p className="muted">报告完成后会从 StateBackend 导出虚拟文件。</p> : (
              <ul className="artifactList">
                {artifacts.map((artifact) => (
                  <li key={artifact.path}><code>{artifact.path}</code><span>{artifact.sizeChars.toLocaleString()} 字符</span></li>
                ))}
              </ul>
            )}
            <p className="virtualHint">“/work” 是本次运行的虚拟目录，不是电脑磁盘路径；MVP-1 结束后不会持久化。</p>
          </article>
        </section>

        <section className="mvpPanel reportPanel">
          <div className="panelHeading">
            <div><p className="stepLabel">03 · 交付</p><h2>Markdown 分析报告</h2></div>
            <span className={report ? "reportState ready" : "reportState"}>{report ? "READY" : "WAITING"}</span>
          </div>
          {report ? <pre className="markdownReport">{report}</pre> : (
            <div className="emptyState reportEmpty">DeepAgent 完成专家委派并写入 /work/final-report.md 后，报告会显示在这里。</div>
          )}
        </section>

        <footer><span>MVP-1 · 单需求 DeepAgent 分析</span><span>下一闭环：信息澄清与同线程恢复</span></footer>
      </section>
    </main>
  );
}
