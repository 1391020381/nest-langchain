import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { DemoModel } from "./agent";
import { Sessions, resumeSchema } from "./sessions";
import { createApp } from "./server";

async function settle(sessions: Sessions, id: string) {
  for (let i = 0; i < 200; i++) {
    const s = sessions.view(id);
    if (s.status !== "running") { assert.notEqual(s.status, "error", s.error); return s; }
    await sleep(20);
  }
  throw new Error("任务未在期限内结束");
}
test("真实 HITL：审批前没有副作用，编辑后执行且不能重复提交", async () => {
  const sessions = new Sessions(() => new DemoModel());
  const s = await settle(sessions, sessions.create("发送邮件").id);
  assert.equal(s.status, "interrupted"); assert.equal(s.outbox.length, 0);
  const payload = resumeSchema.parse({ revision: s.revision, reviews: [{ interruptId: s.pending[0].id, decisions: [{ type: "edit", editedAction: {
    name: "send_email", args: { to: "edited@example.com", subject: "修改主题", body: "修改正文" },
  } }] }] });
  sessions.resume(s.id, payload);
  assert.throws(() => sessions.resume(s.id, payload), /审批已更新/);
  const done = await settle(sessions, s.id);
  assert.equal(done.status, "completed"); assert.equal(done.outbox.length, 1);
  assert.equal(done.outbox[0].to, "edited@example.com"); assert.equal(done.outbox[0].body, "修改正文");
});
test("批量审批：决策必须完整；禁止混合拒绝；两封获批后均执行", async () => {
  const sessions = new Sessions(() => new DemoModel());
  const s = await settle(sessions, sessions.create("批量发送").id);
  const payload = { revision: s.revision, reviews: [{ interruptId: s.pending[0].id, decisions: [{ type: "approve" }] }] };
  assert.throws(() => sessions.resume(s.id, resumeSchema.parse(payload)), /一一对应/);
  assert.throws(() => sessions.resume(s.id, resumeSchema.parse({ ...payload, reviews: [{ interruptId: s.pending[0].id, decisions: [{ type: "approve" }, { type: "reject", message: "不发第二封" }] }] })), /不支持同批混合/);
  sessions.resume(s.id, resumeSchema.parse({ ...payload, reviews: [{ interruptId: s.pending[0].id, decisions: [{ type: "approve" }, { type: "approve" }] }] }));
  const done = await settle(sessions, s.id);
  assert.equal(done.outbox.length, 2); assert.deepEqual(done.outbox.map((m) => m.to).sort(), ["manager@example.com", "team@example.com"]);
});
test("人工 respond 返回结果，发送工具不能用 respond 冒充成功", async () => {
  const sessions = new Sessions(() => new DemoModel());
  const s = await settle(sessions, sessions.create("请提问").id);
  sessions.resume(s.id, resumeSchema.parse({ revision: 0, reviews: [{ interruptId: s.pending[0].id, decisions: [{ type: "respond", message: "面向技术团队，500字。" }] }] }));
  const done = await settle(sessions, s.id);
  assert.equal(done.status, "completed"); assert.equal(done.outbox.length, 0);
  assert.ok(JSON.stringify(done.messages).includes("面向技术团队"));
  const mail = await settle(sessions, sessions.create("邮件").id);
  assert.throws(() => sessions.resume(mail.id, resumeSchema.parse({ revision: 0, reviews: [{ interruptId: mail.pending[0].id, decisions: [{ type: "respond", message: "不要发" }] }] })), /不支持/);
});
test("HTTP：页面、会话恢复、输入校验与跨站请求拦截", async () => {
  const sessions = new Sessions(() => new DemoModel());
  const server = createApp(sessions, "demo");
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: unknown, origin?: string) => fetch(url + path, { method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await post("/api/sessions", { prompt: "邮件" }, "https://example.com")).status, 403);
    assert.equal((await post("/api/sessions", { prompt: "" })).status, 400);
    const created = await post("/api/sessions", { prompt: "邮件" }); assert.equal(created.status, 202);
    const { id } = await created.json() as { id: string };
    await settle(sessions, id);
    const state = await (await fetch(`${url}/api/sessions/${id}`)).json() as ReturnType<Sessions["view"]>;
    const payload = { revision: state.revision, reviews: [{ interruptId: state.pending[0].id, decisions: [{ type: "reject", message: "取消发送" }] }] };
    assert.equal((await post(`/api/sessions/${id}/resume`, payload)).status, 202);
    assert.equal((await post(`/api/sessions/${id}/resume`, payload)).status, 409);
    assert.equal((await settle(sessions, id)).outbox.length, 0);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
