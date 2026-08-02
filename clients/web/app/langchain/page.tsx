"use client";

import Link from "next/link";
import { useState } from "react";

const DEFAULT_INPUT = "用户注册时必须绑定手机号，密码至少8位";

const DEMOS = [
  { id: "invoke", path: "/api/langchain/invoke", kind: "input" as const },
  { id: "stream", path: "/api/langchain/stream", kind: "stream" as const },
  { id: "batch", path: "/api/langchain/batch", kind: "batch" as const },
  {
    id: "prompt-preview",
    path: "/api/langchain/prompt-preview",
    kind: "input" as const,
  },
  {
    id: "prompt-to-model",
    path: "/api/langchain/prompt-to-model",
    kind: "input" as const,
  },
  {
    id: "chain-invoke",
    path: "/api/langchain/chain-invoke",
    kind: "input" as const,
  },
  {
    id: "chain-stream",
    path: "/api/langchain/chain-stream",
    kind: "stream" as const,
  },
  {
    id: "chain-batch",
    path: "/api/langchain/chain-batch",
    kind: "batch" as const,
  },
  {
    id: "tool-bind",
    path: "/api/langchain/tool-bind",
    kind: "input" as const,
  },
  {
    id: "tool-loop",
    path: "/api/langchain/tool-loop",
    kind: "input" as const,
  },
] as const;

type DemoId = (typeof DEMOS)[number]["id"];

export default function LangChainDemosPage() {
  const [demoId, setDemoId] = useState<DemoId>("invoke");
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const demo = DEMOS.find((item) => item.id === demoId)!;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;

  async function handleSubmit() {
    setLoading(true);
    setError("");
    setResult("");
    try {
      const body =
        demo.kind === "batch"
          ? {
              inputs: input
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            }
          : { input };

      const res = await fetch(`${base}${demo.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      if (demo.kind === "stream") {
        const reader = res.body?.getReader();
        if (!reader) throw new Error("no response body");
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setResult(acc);
        }
        return;
      }

      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult("");
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>LangChain Demos</h1>
      <p>
        <Link href="/">← Requirement Extract</Link>
      </p>
      <label style={{ display: "block", marginBottom: 8 }}>
        Demo{" "}
        <select
          value={demoId}
          onChange={(e) => setDemoId(e.target.value as DemoId)}
        >
          {DEMOS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </select>
      </label>
      <p style={{ color: "#666", fontSize: 14 }}>
        {demo.kind === "batch"
          ? "Batch：每行一条输入"
          : demo.kind === "stream"
            ? "Stream：响应将逐块追加显示"
            : "单条 input"}
      </p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={8}
        style={{ width: "100%" }}
      />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "请求中…" : "运行"}
        </button>
      </div>
      {error ? <pre style={{ color: "crimson" }}>{error}</pre> : null}
      <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{result}</pre>
    </main>
  );
}
