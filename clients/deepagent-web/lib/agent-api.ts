import {
  AgentStreamEventSchema,
  type AgentRunRequest,
  type AgentStreamEvent,
} from "@autix/deepagent-contracts";

// 默认走 Next 同源代理。这样通过 Network 地址访问 Web 时，浏览器不会
// 错误地把 localhost:4100 当成自己所在设备的 API 地址。
const DEFAULT_API_BASE_URL = "";

export type StreamAgentRunOptions = {
  signal?: AbortSignal;
  onEvent: (event: AgentStreamEvent) => void;
};

function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/u, "") ??
    DEFAULT_API_BASE_URL
  );
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    if (Array.isArray(body?.message)) return body.message.join("；");
    if (body?.message) return body.message;
  }

  return (await response.text().catch(() => "")) || `请求失败（${response.status}）`;
}

function parseSseFrame(frame: string): AgentStreamEvent | undefined {
  const data = frame
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
    .trim();

  if (!data || data === "[DONE]") return undefined;

  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    throw new Error("服务返回了无法解析的流式数据");
  }

  const parsed = AgentStreamEventSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("服务返回了不符合约定的事件");
  }
  return parsed.data;
}

export async function streamAgentRun(
  request: AgentRunRequest,
  options: StreamAgentRunOptions,
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/agent/runs/stream`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  if (!response.body) {
    throw new Error("浏览器没有收到流式响应");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatchFrame = (frame: string): boolean => {
    const event = parseSseFrame(frame);
    if (!event) return false;
    options.onEvent(event);
    return event.type === "done";
  };

  const cancelReader = async (reason?: unknown): Promise<void> => {
    await reader.cancel(reason).catch(() => undefined);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      // Normalize after appending so a CRLF pair split across two chunks is
      // still recognized as one line ending.
      buffer = buffer.replace(/\r\n/gu, "\n");

      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (dispatchFrame(frame)) {
          await cancelReader();
          return;
        }
        boundary = buffer.indexOf("\n\n");
      }

      if (done) break;
    }

    dispatchFrame(buffer);
  } catch (error) {
    // Releasing a lock does not stop the fetch. Explicit cancellation ensures
    // malformed protocol data or a failing event consumer also closes the HTTP
    // stream and propagates cancellation to the API's AbortSignal.
    await cancelReader(error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
