"use client";

import Link from "next/link";
import { useState } from "react";
import type { RequirementResult } from "@autix/contracts";

const DEFAULT_INPUT = "用户注册时必须绑定手机号，密码至少8位";

export default function Home() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [result, setResult] = useState<RequirementResult | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/requirement/extract`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        }
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as RequirementResult;
      setResult(data);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Requirement Extract Demo</h1>
      <p>
        <Link href="/langchain">LangChain Demos →</Link>
      </p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={8}
        style={{ width: "100%" }}
      />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "提取中…" : "提取"}
        </button>
      </div>
      {error ? <pre style={{ color: "crimson" }}>{error}</pre> : null}
      <pre style={{ marginTop: 16 }}>{JSON.stringify(result, null, 2)}</pre>
    </main>
  );
}
