const $ = (id) => document.getElementById(id);
const labels = { approve: "批准执行", edit: "修改后执行", reject: "拒绝执行", respond: "回答问题" };
let state, timer, renderedRevision, submitting = false;
const el = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json(); if (!res.ok) throw new Error(data.error || "请求失败"); return data;
}
function field(parent, title, value, multiline = false) {
  const id = crypto.randomUUID(); const label = el("label", title); label.htmlFor = id;
  const input = el(multiline ? "textarea" : "input"); input.id = id; input.value = value; input.required = true;
  if (multiline) input.rows = 4; parent.append(label, input); return input;
}
function renderReview(s) {
  const key = `${s.id}:${s.revision}:${s.status}`;
  if (renderedRevision === key) return; renderedRevision = key;
  const root = $("review"); root.replaceChildren();
  if (s.status !== "interrupted") { root.append(el("p", s.status === "running" ? "Agent 正在运行，请稍候…" : s.status === "error" ? "执行中止，请检查配置并开始新任务。" : "本次流程已结束。", "empty")); return; }
  const form = el("form"); const groups = [];
  if (s.pending.some((p) => p.value.actionRequests.length > 1)) form.append(el("p", "当前 JS 版本限制：同一批次请全部批准/修改，或全部拒绝。若只需部分发送，请全部拒绝后重新发起任务。", "muted"));
  for (const pending of s.pending) {
    const decisions = [];
    pending.value.actionRequests.forEach((action, i) => {
      const box = el("div", undefined, "action"); box.append(el("h3", `${i + 1}. ${action.name === "send_email" ? "发送模拟邮件" : "向你提问"}`), el("pre", JSON.stringify(action.args, null, 2)));
      const label = el("label", "你的决定"); const select = el("select"); select.id = crypto.randomUUID(); label.htmlFor = select.id;
      const placeholder = el("option", "请选择决策"); placeholder.value = ""; select.append(placeholder); select.required = true;
      const allowed = pending.value.reviewConfigs.find((c) => c.actionName === action.name).allowedDecisions;
      for (const type of allowed) { const option = el("option", labels[type]); option.value = type; select.append(option); }
      const details = el("div"); let fields = {};
      select.onchange = () => {
        details.replaceChildren(); fields = {};
        if (select.value === "edit") {
          fields.to = field(details, "收件人", action.args.to); fields.to.type = "email";
          fields.subject = field(details, "主题", action.args.subject);
          fields.body = field(details, "正文", action.args.body, true);
        } else if (["reject", "respond"].includes(select.value)) fields.message = field(details, select.value === "reject" ? "拒绝原因与下一步" : "你的回答", select.value === "reject" ? "用户拒绝本次发送，请停止，不要重试。" : "", true);
      };
      decisions.push(() => select.value === "edit" ? { type: "edit", editedAction: { name: action.name, args: { to: fields.to.value, subject: fields.subject.value, body: fields.body.value } } } : fields.message ? { type: select.value, message: fields.message.value } : { type: select.value });
      box.append(label, select, details); form.append(box);
    });
    groups.push(() => ({ interruptId: pending.id, decisions: decisions.map((read) => read()) }));
  }
  const button = el("button", "提交决策并继续", "primary"); form.append(button);
  form.onsubmit = async (event) => {
    event.preventDefault(); if (submitting) return; submitting = true; button.disabled = true; $("notice").textContent = "";
    try { const next = await api(`/api/sessions/${s.id}/resume`, { revision: s.revision, reviews: groups.map((read) => read()) }); render(next); schedule(); }
    catch (e) { $("notice").textContent = e.message; button.disabled = false; schedule(); }
    finally { submitting = false; }
  };
  root.append(form);
}
function render(s) {
  state = s; localStorage.setItem("hitl-session", s.id);
  $("status").textContent = { running: "运行中", interrupted: "等待你的决定", completed: "已完成", error: "执行失败" }[s.status];
  $("thread").textContent = `会话 ${s.id} · 审批版本 ${s.revision}`;
  $("start-button").disabled = s.status === "running";
  if (s.error) $("notice").textContent = s.error;
  renderReview(s);
  $("messages").replaceChildren();
  for (const m of s.messages.filter((m) => ["human", "ai", "tool"].includes(m.role))) {
    if (!m.content || (Array.isArray(m.content) && !m.content.length)) continue;
    const box = el("div", undefined, "message"); box.append(el("span", { human: "你", ai: "Agent", tool: "工具 / 人工反馈" }[m.role], "role"), el("div", typeof m.content === "string" ? m.content : JSON.stringify(m.content))); $("messages").append(box);
  }
  $("count").textContent = s.outbox.length; $("outbox").replaceChildren();
  for (const mail of s.outbox) $("outbox").append(el("div", `收件人：${mail.to}\n主题：${mail.subject}\n${mail.body}\n\n模拟发送时间：${new Date(mail.sentAt).toLocaleString()}`, "mail"));
}
function schedule() { clearTimeout(timer); if (state?.status === "running") timer = setTimeout(refresh, 700); }
async function refresh() {
  try { render(await api(`/api/sessions/${state.id}`)); schedule(); }
  catch (e) { $("notice").textContent = e.message; $("start-button").disabled = false; }
}
document.querySelectorAll("[data-prompt]").forEach((button) => { button.onclick = () => { $("prompt").value = button.dataset.prompt; }; });
$("start").onsubmit = async (event) => {
  event.preventDefault(); clearTimeout(timer); $("notice").textContent = ""; $("start-button").disabled = true;
  try { render(await api("/api/sessions", { prompt: $("prompt").value })); schedule(); }
  catch (e) { $("notice").textContent = e.message; $("start-button").disabled = false; }
};
try {
  const config = await api("/api/config"); $("mode").textContent = config.mode === "demo" ? "免密钥演示 · 固定模型输出" : "真实模型 · 模拟邮件";
  const id = localStorage.getItem("hitl-session"); if (id) { state = { id }; await refresh(); }
} catch (e) { $("notice").textContent = e.message; }
