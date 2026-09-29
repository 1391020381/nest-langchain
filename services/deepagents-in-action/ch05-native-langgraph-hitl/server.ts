import { config as loadEnv } from "dotenv";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { approvalDecisionSchema } from "./graph";
import { HttpError, NativeApprovalSessions } from "./sessions";

const createSchema = z
  .object({ request: z.string().trim().min(1).max(4_000) })
  .strict();
const resumeSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    decision: approvalDecisionSchema,
  })
  .strict();

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (!req.headers["content-type"]?.startsWith("application/json")) {
    throw new HttpError(415, "请使用 JSON 请求。");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65_536) throw new HttpError(413, "请求内容过大。");
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new HttpError(400, "JSON 格式无效。");
  }
}

export function createApp(sessions = new NativeApprovalSessions()) {
  return createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(value));
    };

    try {
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host || "")) {
        throw new HttpError(403, "仅支持本地访问。");
      }
      if (
        req.headers.origin &&
        req.headers.origin !== `http://${req.headers.host}`
      ) {
        throw new HttpError(403, "不允许跨站请求。");
      }

      const path = new URL(req.url || "/", `http://${req.headers.host}`).pathname;
      if (req.method === "GET" && path === "/api/config") {
        return json(200, {
          mode: "native-langgraph",
          runName: "stage3-native-langgraph-hitl",
        });
      }
      if (req.method === "POST" && path === "/api/sessions") {
        const input = createSchema.parse(await readJson(req));
        return json(201, await sessions.create(input.request));
      }

      const match = path.match(/^\/api\/sessions\/([\w-]+)(\/resume)?$/);
      if (match && req.method === "GET" && !match[2]) {
        return json(200, sessions.view(match[1]));
      }
      if (match && req.method === "POST" && match[2]) {
        const input = resumeSchema.parse(await readJson(req));
        return json(200, await sessions.resume(match[1], input));
      }

      const files: Record<string, [string, string]> = {
        "/": ["index.html", "text/html"],
        "/app.js": ["app.js", "text/javascript"],
        "/style.css": ["style.css", "text/css"],
      };
      if (req.method === "GET" && files[path]) {
        const [file, type] = files[path];
        const body = await readFile(new URL(`./web/${file}`, import.meta.url));
        res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
        res.end(body);
        return;
      }

      json(404, { error: "地址不存在。" });
    } catch (error) {
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 500;
      const message =
        error instanceof HttpError
          ? error.message
          : error instanceof z.ZodError
            ? "输入参数无效，请检查审批内容。"
            : "服务处理失败。";
      json(status, { error: message });
    }
  });
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  loadEnv({
    path: fileURLToPath(new URL("../.env", import.meta.url)),
    quiet: true,
  });
  const port = z.coerce
    .number()
    .int()
    .min(1)
    .max(65_535)
    .parse(process.env.NATIVE_HITL_PORT || 2030);
  const app = createApp();
  app.on("error", (error: NodeJS.ErrnoException) => {
    console.error(
      `启动失败：${error.code || "未知错误"}，可通过 NATIVE_HITL_PORT 更换端口。`,
    );
    process.exitCode = 1;
  });
  app.listen(port, "127.0.0.1", () => {
    console.log(`原生 LangGraph HITL：http://127.0.0.1:${port}`);
    console.log("邮件只写入内存模拟发件箱，不会真实发送。");
  });
}

