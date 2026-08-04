"use client";

import { useState } from "react";
import { ComponentRenderer } from "./ComponentRenderer";
import { analyzeStream, uiAction, uiChat } from "@/lib/api";
import { buttonStyle, inputStyle } from "./styles";
import type {
  AIUIResponse,
  StreamMessage,
  UIAction,
  UIResponse,
} from "@/types/ui-types";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  components?: UIResponse[];
}

interface StreamingMessage {
  content: string;
  components?: UIResponse[];
  progress?: string;
}

function progressLabel(payload: StreamMessage["payload"]): string {
  if (!payload || !("step" in payload)) return "分析中…";
  const { step, totalSteps, agent, status } = payload;
  const who = agent ? ` · ${agent}` : "";
  return `进度 ${step}/${totalSteps}${who} · ${status}`;
}

export function AIChatContainer({
  token,
  conversationId,
}: {
  token: string;
  conversationId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      content:
        "欢迎使用 Autix AI 需求分析助理。请描述你的需求，或直接开始对话。",
    },
  ]);
  const [streamingMessage, setStreamingMessage] =
    useState<StreamingMessage | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAIMessage = (response: AIUIResponse) => {
    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        content: response.message,
        components: response.components,
      },
    ]);
  };

  const runAnalyzeStream = async () => {
    setStreamingMessage({ content: "", progress: "准备分析…" });
    setError(null);

    let content = "";
    let components: UIResponse[] | undefined;
    let settled = false;

    try {
      await analyzeStream(token, conversationId, (msg) => {
        switch (msg.messageType) {
          case "progress":
            setStreamingMessage((prev) => ({
              content: prev?.content ?? content,
              components: prev?.components ?? components,
              progress: progressLabel(msg.payload),
            }));
            break;
          case "markdown": {
            const p = msg.payload as {
              content: string;
              isChunk: boolean;
            } | null;
            if (!p) break;
            content = p.isChunk ? content + p.content : p.content;
            setStreamingMessage((prev) => ({
              ...prev,
              content,
              progress: prev?.progress,
              components: prev?.components ?? components,
            }));
            break;
          }
          case "ui": {
            const p = msg.payload as {
              components: UIResponse[];
            } | null;
            if (!p) break;
            components = p.components;
            setStreamingMessage((prev) => ({
              content: prev?.content ?? content,
              components,
              progress: prev?.progress,
            }));
            break;
          }
          case "error": {
            const p = msg.payload as { message: string } | null;
            settled = true;
            setError(p?.message ?? "stream error");
            setStreamingMessage(null);
            break;
          }
          case "done":
            settled = true;
            setMessages((prev) => [
              ...prev,
              {
                role: "ai",
                content: content || "分析完成",
                components,
              },
            ]);
            setStreamingMessage(null);
            break;
          default:
            break;
        }
      });
    } catch (err) {
      settled = true;
      setError(err instanceof Error ? err.message : "analyze stream failed");
      setStreamingMessage(null);
    } finally {
      if (!settled) {
        setStreamingMessage(null);
        setError((prev) => prev ?? "stream ended unexpectedly");
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content: content || "分析中断，请重试。",
            components,
          },
        ]);
      }
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const data = await uiChat(token, conversationId, text);
      addAIMessage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "chat failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: UIAction) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      if (
        action.payload.type === "click" &&
        action.payload.actionId === "retry_analyze"
      ) {
        await runAnalyzeStream();
        return;
      }
      const data = await uiAction(token, conversationId, action);
      addAIMessage(data);
      if (data.streamSuggested) {
        await runAnalyzeStream();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "action failed");
    } finally {
      setLoading(false);
    }
  };

  const lastAiIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "ai") return i;
    }
    return -1;
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minHeight: 320,
          maxHeight: "70vh",
          overflowY: "auto",
          padding: 12,
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "10px 14px",
              borderRadius: 8,
              background: msg.role === "user" ? "#4f46e5" : "#fff",
              color: msg.role === "user" ? "#fff" : "#1e293b",
              border: msg.role === "ai" ? "1px solid #e2e8f0" : "none",
            }}
          >
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
            {msg.components?.map((comp, j) => (
              <div key={j} style={{ marginTop: 10 }}>
                <ComponentRenderer
                  component={comp}
                  onAction={handleAction}
                  disabled={loading || i !== lastAiIndex}
                />
              </div>
            ))}
          </div>
        ))}

        {streamingMessage && (
          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: "85%",
              padding: "10px 14px",
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #c7d2fe",
            }}
          >
            {streamingMessage.progress && (
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 12,
                  color: "#6366f1",
                }}
              >
                {streamingMessage.progress}
              </p>
            )}
            {streamingMessage.content && (
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {streamingMessage.content}
              </p>
            )}
            {streamingMessage.components?.map((comp, j) => (
              <div key={j} style={{ marginTop: 10 }}>
                <ComponentRenderer
                  component={comp}
                  onAction={handleAction}
                  disabled
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p style={{ margin: 0, color: "#dc2626", fontSize: 13 }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...inputStyle, marginTop: 0, flex: 1 }}
          value={input}
          disabled={loading}
          placeholder="输入消息…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <button
          type="button"
          style={buttonStyle("primary", loading || !input.trim())}
          disabled={loading || !input.trim()}
          onClick={() => void handleSend()}
        >
          {loading ? "…" : "发送"}
        </button>
      </div>
    </div>
  );
}
