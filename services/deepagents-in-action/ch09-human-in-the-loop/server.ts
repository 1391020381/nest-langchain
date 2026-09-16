import { createServer, type IncomingMessage } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { config } from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { DemoModel } from "./agent";
import { HttpError, resumeSchema, Sessions } from "./sessions";

async function readJson(req: IncomingMessage) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw new HttpError(415, "请使用 JSON 请求。");
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) throw new HttpError(413, "请求内容过大。");
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new HttpError(400, "JSON 格式无效。"); }
}

export function createApp(sessions: Sessions, mode: string) {
  return createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    const json = (status: number, data: unknown) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(data)); };
    try {
      // 本地教学服务只接受本机 Host 和同源 Web 请求。
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host || "")) throw new HttpError(403, "仅支持本地访问。");
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw new HttpError(403, "不允许跨站请求。");
      const path = new URL(req.url || "/", `http://${req.headers.host}`).pathname;
      if (req.method === "GET" && path === "/api/config") return json(200, { mode });
      if (req.method === "POST" && path === "/api/sessions") {
        const { prompt } = z.object({ prompt: z.string().trim().min(1).max(4000) }).strict().parse(await readJson(req));
        return json(202, sessions.create(prompt));
      }
      const match = path.match(/^\/api\/sessions\/([\w-]+)(\/resume)?$/);
      if (match && req.method === "GET" && !match[2]) return json(200, sessions.view(match[1]));
      if (match && req.method === "POST" && match[2]) return json(202, sessions.resume(match[1], resumeSchema.parse(await readJson(req))));
      const files: Record<string, [string, string]> = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/style.css": ["style.css", "text/css"] };
      if (req.method === "GET" && files[path]) {
        const [file, type] = files[path];
        const data = await readFile(new URL(`./web/${file}`, import.meta.url));
        res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` }); res.end(data); return;
      }
      json(404, { error: "地址不存在。" });
    } catch (error) {
      json(error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : 500,
        { error: error instanceof HttpError ? error.message : error instanceof z.ZodError ? "输入参数无效，请检查邮件地址、必填内容和审批格式。" : "服务处理失败。" });
    }
  });
}

// 被测试导入时不加载密钥，也不启动监听。
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
  const demo = process.argv.includes("--demo");
  const siliconflowKey = process.env.SILICONFLOW_API_KEY?.trim();
  if (!demo && !(siliconflowKey || process.env.OPENAI_API_KEY)) throw new Error("请在服务 .env 配置模型密钥，或运行 bun run hitl:demo。");
  const sessions = new Sessions(() => demo ? new DemoModel() : new ChatOpenAI({
    apiKey: siliconflowKey || process.env.OPENAI_API_KEY,
    model: siliconflowKey ? process.env.MODEL_NAME || "Qwen/Qwen2.5-7B-Instruct" : process.env.DEEPAGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4",
    configuration: { baseURL: siliconflowKey ? "https://api.siliconflow.cn/v1" : process.env.OPENAI_BASE_URL },
    temperature: 0, timeout: 60000, maxRetries: 0,
  }));
  const port = z.coerce.number().int().min(1).max(65535).parse(process.env.HITL_PORT || 2029);
  const app = createApp(sessions, demo ? "demo" : "model");
  app.on("error", (error: NodeJS.ErrnoException) => { console.error(`启动失败：${error.code || "未知错误"}，可通过 HITL_PORT 更换端口。`); process.exitCode = 1; });
  app.listen(port, "127.0.0.1", () => console.log(`HITL ${demo ? "免密钥演示" : "真实模型"}：http://127.0.0.1:${port}（邮件仅模拟）`));
}
