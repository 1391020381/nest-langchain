import type {
  AgentRunRequest,
  AgentStreamEvent,
  LiveHealthResponse,
  ModelDiagnosticResponse,
  ReadinessResponse,
} from "@autix/requirement-deepagent-contracts";
import { isAgentStreamEvent } from "@autix/requirement-deepagent-contracts";

interface ApiErrorBody {
  message?: string | string[];
}

export function formatApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "请求失败，请确认新 API 已在 4200 端口启动。";
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as
    | T
    | ApiErrorBody
    | null;
  if (!body) {
    throw new Error(`API 返回了无法解析的响应（HTTP ${response.status}）。`);
  }
  if (!response.ok && !("status" in (body as object))) {
    const message = (body as ApiErrorBody).message;
    throw new Error(
      Array.isArray(message)
        ? message.join("；")
        : message || `API 请求失败（HTTP ${response.status}）。`,
    );
  }
  return body as T;
}

export function getLiveness(): Promise<LiveHealthResponse> {
  return requestJson<LiveHealthResponse>("/api/health/live");
}

export function getReadiness(): Promise<ReadinessResponse> {
  return requestJson<ReadinessResponse>("/api/health/ready");
}

export function diagnoseModel(): Promise<ModelDiagnosticResponse> {
  return requestJson<ModelDiagnosticResponse>("/api/diagnostics/model", {
    method: "POST",
    headers: {
      "X-Trace-Id": globalThis.crypto?.randomUUID?.() ?? `web-${Date.now()}`,
    },
  });
}

export class SseEventDecoder {
  private buffer = "";

  push(chunk: string): AgentStreamEvent[] {
    this.buffer += chunk.replaceAll("\r\n", "\n");
    const blocks = this.buffer.split("\n\n");
    this.buffer = blocks.pop() ?? "";
    return blocks.flatMap((block) => this.decodeBlock(block));
  }

  finish(): AgentStreamEvent[] {
    const trailing = this.buffer;
    this.buffer = "";
    return trailing.trim() ? this.decodeBlock(trailing) : [];
  }

  private decodeBlock(block: string): AgentStreamEvent[] {
    if (!block || block.startsWith(":")) return [];
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return [];
    try {
      const parsed: unknown = JSON.parse(data);
      return isAgentStreamEvent(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  }
}

export async function streamRequirementAnalysis(
  request: AgentRunRequest,
  options: {
    signal: AbortSignal;
    onEvent: (event: AgentStreamEvent) => void;
  },
): Promise<void> {
  const response = await fetch("/api/agent/runs/stream", {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `分析请求失败（HTTP ${response.status}）。`);
  }
  if (!response.body) throw new Error("浏览器没有收到可读取的事件流。");

  const reader = response.body.getReader();
  const textDecoder = new TextDecoder();
  const eventDecoder = new SseEventDecoder();
  let terminalReceived = false;

  while (true) {
    const { done, value } = await reader.read();
    const events = eventDecoder.push(
      textDecoder.decode(value, { stream: !done }),
    );
    for (const event of events) {
      if (event.type === "run.done") terminalReceived = true;
      options.onEvent(event);
    }
    if (done) break;
  }
  for (const event of eventDecoder.finish()) {
    if (event.type === "run.done") terminalReceived = true;
    options.onEvent(event);
  }
  if (!terminalReceived && !options.signal.aborted) {
    throw new Error("事件流在 run.done 之前意外结束。");
  }
}
