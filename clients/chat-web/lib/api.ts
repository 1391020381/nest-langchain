import type {
  AIUIResponse,
  AIUIResponseWithStreamHint,
  StreamMessage,
  UIAction,
} from "@/types/ui-types";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";

export const TOKEN_KEY = "chat_token";

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function register(
  email: string,
  password: string,
  name?: string,
) {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) throw new Error("register failed");
  return res.json() as Promise<{ id: string; email: string }>;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("login failed");
  return res.json() as Promise<{ accessToken: string }>;
}

export async function createConversation(token: string) {
  const res = await fetch(`${API}/api/conversations`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("create conversation failed");
  return res.json() as Promise<{ id: string }>;
}

export async function uiChat(
  token: string,
  conversationId: string,
  input: string,
) {
  const res = await fetch(`${API}/api/ui-chat/${conversationId}/chat`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error("ui chat failed");
  return res.json() as Promise<AIUIResponse>;
}

export async function uiAction(
  token: string,
  conversationId: string,
  action: UIAction,
) {
  const res = await fetch(`${API}/api/ui-chat/${conversationId}/action`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error("ui action failed");
  return res.json() as Promise<AIUIResponseWithStreamHint>;
}

/** Native fetch ReadableStream SSE client — no EventSource / extra deps. */
export async function analyzeStream(
  token: string,
  conversationId: string,
  onMessage: (msg: StreamMessage) => void,
): Promise<void> {
  const res = await fetch(
    `${API}/api/ui-chat/${conversationId}/analyze/stream`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({}),
    },
  );
  if (!res.ok || !res.body) throw new Error("analyze stream failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const emitParts = (parts: string[]) => {
    for (const part of parts) {
      const line = part
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("data: "));
      if (!line) continue;
      const json = line.slice("data: ".length);
      if (!json || json === "[DONE]") continue;
      onMessage(JSON.parse(json) as StreamMessage);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    emitParts(parts);
  }

  // Flush trailing buffer (final event may lack trailing \n\n)
  if (buffer.trim()) {
    emitParts([buffer]);
  }
}
