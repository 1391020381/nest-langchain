"use client";

import { useEffect, useState } from "react";
import { AIChatContainer } from "@/components/ai-ui/AIChatContainer";
import {
  TOKEN_KEY,
  createConversation,
  login,
  register,
} from "@/lib/api";
import { buttonStyle, inputStyle } from "@/components/ai-ui/styles";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) setToken(saved);
  }, []);

  const persistToken = (accessToken: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
  };

  const handleLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const { accessToken } = await login(email.trim(), password);
      persistToken(accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    setBusy(true);
    setError(null);
    try {
      await register(email.trim(), password);
      const { accessToken } = await login(email.trim(), password);
      persistToken(accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "register failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const conv = await createConversation(token);
      setConversationId(conv.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "create conversation failed",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setConversationId(null);
  };

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 16px", fontSize: 22 }}>Autix AI UI Chat</h1>

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 16,
          padding: 12,
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#fff",
        }}
      >
        {!token ? (
          <>
            <input
              style={{ ...inputStyle, marginTop: 0, width: 200 }}
              type="email"
              placeholder="email"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              style={{ ...inputStyle, marginTop: 0, width: 160 }}
              type="password"
              placeholder="password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              style={buttonStyle("primary", busy)}
              disabled={busy || !email || !password}
              onClick={() => void handleLogin()}
            >
              登录
            </button>
            <button
              type="button"
              style={buttonStyle("secondary", busy)}
              disabled={busy || !email || !password}
              onClick={() => void handleRegister()}
            >
              注册
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 13, color: "#64748b" }}>已登录</span>
            {!conversationId && (
              <button
                type="button"
                style={buttonStyle("primary", busy)}
                disabled={busy}
                onClick={() => void handleCreateConversation()}
              >
                新建会话
              </button>
            )}
            {conversationId && (
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                会话 {conversationId.slice(0, 8)}…
              </span>
            )}
            <button
              type="button"
              style={buttonStyle("ghost", busy)}
              disabled={busy}
              onClick={handleLogout}
            >
              退出
            </button>
          </>
        )}
      </section>

      {error && (
        <p style={{ margin: "0 0 12px", color: "#dc2626", fontSize: 13 }}>
          {error}
        </p>
      )}

      {token && conversationId ? (
        <AIChatContainer token={token} conversationId={conversationId} />
      ) : (
        <p style={{ color: "#64748b", fontSize: 14 }}>
          {!token
            ? "请先登录或注册，再创建会话开始 AI UI 对话。"
            : "已登录，请点击「新建会话」。"}
        </p>
      )}
    </main>
  );
}
