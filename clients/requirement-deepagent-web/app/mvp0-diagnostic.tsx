"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  LiveHealthResponse,
  ModelDiagnosticResponse,
  ReadinessResponse,
} from "@autix/requirement-deepagent-contracts";
import {
  diagnoseModel,
  formatApiError,
  getLiveness,
  getReadiness,
} from "@/lib/api";

type AsyncState<T> =
  | { phase: "loading" }
  | { phase: "success"; data: T }
  | { phase: "error"; message: string };

function StatusDot({ positive }: { positive: boolean }) {
  return <span className={positive ? "dot dotPositive" : "dot dotNegative"} />;
}

export default function MvpZeroDiagnostic() {
  const [live, setLive] = useState<AsyncState<LiveHealthResponse>>({
    phase: "loading",
  });
  const [ready, setReady] = useState<AsyncState<ReadinessResponse>>({
    phase: "loading",
  });
  const [diagnostic, setDiagnostic] =
    useState<AsyncState<ModelDiagnosticResponse> | null>(null);

  const refreshHealth = useCallback(async () => {
    setLive({ phase: "loading" });
    setReady({ phase: "loading" });
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
  }, [refreshHealth]);

  async function runDiagnostic() {
    setDiagnostic({ phase: "loading" });
    try {
      setDiagnostic({ phase: "success", data: await diagnoseModel() });
    } catch (error) {
      setDiagnostic({ phase: "error", message: formatApiError(error) });
    }
  }

  const apiAlive = live.phase === "success" && live.data.status === "alive";
  const configReady =
    ready.phase === "success" && ready.data.status === "ready";
  const diagnosticReady =
    diagnostic?.phase === "success" && diagnostic.data.status === "ready";

  return (
    <main>
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <section className="shell">
        <header className="hero">
          <div className="brandRow">
            <span className="brandMark">DA</span>
            <span className="eyebrow">DEEPAGENT · REQUIREMENT PLATFORM</span>
          </div>
          <div className="heroCopy">
            <div>
              <p className="stepLabel">MVP-0 · 工程底座</p>
              <h1>先确认模型真的能调用工具</h1>
              <p className="lead">
                这是全新需求分析平台的第一条闭环。它只检查 Web、API、模型配置和
                tool calling，不包含旧项目的业务代码。
              </p>
            </div>
            <button className="secondaryButton" onClick={() => void refreshHealth()}>
              刷新基础状态
            </button>
          </div>
        </header>

        <section className="statusGrid" aria-label="基础状态">
          <article className="statusCard">
            <div className="cardTopline">
              <span>01</span>
              <StatusDot positive={apiAlive} />
            </div>
            <h2>API 服务</h2>
            <p>
              {live.phase === "loading" && "正在连接 4200 端口…"}
              {live.phase === "error" && live.message}
              {live.phase === "success" &&
                (apiAlive ? "服务已启动，存活检查正常。" : "服务返回了异常状态。")}
            </p>
            <span className={apiAlive ? "badge badgeGood" : "badge"}>
              {apiAlive ? "ALIVE" : live.phase === "loading" ? "CHECKING" : "OFFLINE"}
            </span>
          </article>

          <article className="statusCard">
            <div className="cardTopline">
              <span>02</span>
              <StatusDot positive={configReady} />
            </div>
            <h2>模型配置</h2>
            <p>
              {ready.phase === "loading" && "正在读取安全配置摘要…"}
              {ready.phase === "error" && ready.message}
              {ready.phase === "success" &&
                ready.data.checks.modelConfiguration.message}
            </p>
            <span className={configReady ? "badge badgeGood" : "badge"}>
              {configReady ? "CONFIGURED" : "ACTION NEEDED"}
            </span>
          </article>

          <article className="statusCard">
            <div className="cardTopline">
              <span>03</span>
              <StatusDot positive={Boolean(diagnosticReady)} />
            </div>
            <h2>Tool Calling</h2>
            <p>
              {diagnostic === null && "尚未向模型发送能力探测请求。"}
              {diagnostic?.phase === "loading" && "模型正在执行最小工具调用…"}
              {diagnostic?.phase === "error" && diagnostic.message}
              {diagnostic?.phase === "success" &&
                (diagnostic.data.status === "ready"
                  ? `验证通过，耗时 ${diagnostic.data.latencyMs}ms。`
                  : diagnostic.data.error.message)}
            </p>
            <span className={diagnosticReady ? "badge badgeGood" : "badge"}>
              {diagnosticReady
                ? "SUPPORTED"
                : diagnostic?.phase === "loading"
                  ? "PROBING"
                  : "NOT VERIFIED"}
            </span>
          </article>
        </section>

        <section className="probePanel">
          <div className="probeContent">
            <p className="stepLabel">实时能力探测</p>
            <h2>执行一次受控的工具调用</h2>
            <p>
              服务端会强制模型调用 <code>mvp0_capability_probe</code>，只验证能力，
              不执行任何业务操作。该请求会产生少量 token 消耗。
            </p>
            {diagnostic?.phase === "success" && (
              <dl className="facts">
                <div>
                  <dt>模型</dt>
                  <dd>{diagnostic.data.configuration.model}</dd>
                </div>
                <div>
                  <dt>自定义地址</dt>
                  <dd>
                    {diagnostic.data.configuration.baseUrlConfigured ? "已配置" : "SDK 默认"}
                  </dd>
                </div>
                <div>
                  <dt>诊断结果</dt>
                  <dd>
                    {diagnostic.data.status === "ready"
                      ? "工具调用正常"
                      : diagnostic.data.error.code}
                  </dd>
                </div>
              </dl>
            )}
          </div>
          <button
            className="primaryButton"
            disabled={diagnostic?.phase === "loading" || !apiAlive}
            onClick={() => void runDiagnostic()}
          >
            {diagnostic?.phase === "loading" ? "正在检查…" : "检查模型能力"}
          </button>
        </section>

        <footer>
          <span>当前范围：工程、配置、连通性</span>
          <span>下一闭环：单需求 DeepAgent 分析</span>
        </footer>
      </section>
    </main>
  );
}
