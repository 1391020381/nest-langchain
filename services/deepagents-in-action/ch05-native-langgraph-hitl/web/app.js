const $ = (id) => document.getElementById(id);
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

let state = null;
let submitting = false;

async function api(path, body) {
  const response = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function inputField(parent, labelText, value, multiline = false) {
  const label = el("label", labelText);
  const input = el(multiline ? "textarea" : "input");
  input.id = crypto.randomUUID();
  label.htmlFor = input.id;
  input.value = value;
  input.required = true;
  if (multiline) input.rows = 5;
  parent.append(label, input);
  return input;
}

async function submitDecision(decision) {
  if (submitting || !state) return;
  submitting = true;
  $("notice").textContent = "";
  document.querySelectorAll("#review button").forEach((button) => {
    button.disabled = true;
  });
  try {
    render(
      await api(`/api/sessions/${state.id}/resume`, {
        revision: state.revision,
        decision,
      }),
    );
  } catch (error) {
    $("notice").textContent = error.message;
    document.querySelectorAll("#review button").forEach((button) => {
      button.disabled = false;
    });
  } finally {
    submitting = false;
  }
}

function renderReview(session) {
  const root = $("review");
  root.replaceChildren();
  if (session.status !== "interrupted" || !session.pending) {
    root.append(
      el(
        "p",
        session.status === "completed"
          ? "操作已获批准并执行。"
          : session.status === "rejected"
            ? "操作已被拒绝，流程结束。"
            : "当前没有待审批操作。",
        "empty",
      ),
    );
    return;
  }

  const proposal = session.pending.value.proposal;
  const form = el("form");
  form.append(el("p", session.pending.value.instruction, "instruction"));
  const to = inputField(form, "收件人", proposal.to);
  to.type = "email";
  const subject = inputField(form, "主题", proposal.subject);
  const body = inputField(form, "正文", proposal.body, true);
  const reason = inputField(
    form,
    "拒绝原因",
    "收件人或正文需要重新确认",
    true,
  );

  const actions = el("div", undefined, "actions");
  const approve = el("button", "批准原稿", "primary");
  approve.type = "button";
  approve.onclick = () => submitDecision({ type: "approve" });
  const edit = el("button", "修改后批准");
  edit.type = "button";
  edit.onclick = () =>
    submitDecision({
      type: "edit",
      action: { to: to.value, subject: subject.value, body: body.value },
    });
  const reject = el("button", "拒绝", "danger");
  reject.type = "button";
  reject.onclick = () =>
    submitDecision({ type: "reject", reason: reason.value });
  actions.append(approve, edit, reject);
  form.append(actions);
  root.append(form);
}

function render(session) {
  state = session;
  localStorage.setItem("native-hitl-session", session.id);
  $("status").textContent = {
    running: "运行中",
    interrupted: "等待人工决策",
    completed: "已完成",
    rejected: "已拒绝",
    error: "执行失败",
  }[session.status];
  $("thread").textContent = `thread_id：${session.id} · revision：${session.revision}`;
  renderReview(session);

  $("result").replaceChildren(
    el("pre", session.result || "流程暂停中，尚未产生最终结果。"),
  );
  $("audit").replaceChildren();
  for (const item of session.audit) $("audit").append(el("li", item));

  $("count").textContent = String(session.outbox.length);
  $("outbox").replaceChildren();
  if (!session.outbox.length) {
    $("outbox").append(el("p", "暂无邮件", "empty"));
  }
  for (const mail of session.outbox) {
    $("outbox").append(
      el(
        "div",
        `收件人：${mail.to}\n主题：${mail.subject}\n\n${mail.body}\n\n模拟发送时间：${new Date(mail.sentAt).toLocaleString()}`,
        "mail",
      ),
    );
  }
}

$("start").onsubmit = async (event) => {
  event.preventDefault();
  $("notice").textContent = "";
  $("start-button").disabled = true;
  try {
    render(await api("/api/sessions", { request: $("request").value }));
  } catch (error) {
    $("notice").textContent = error.message;
  } finally {
    $("start-button").disabled = false;
  }
};

try {
  const id = localStorage.getItem("native-hitl-session");
  if (id) render(await api(`/api/sessions/${id}`));
} catch (error) {
  localStorage.removeItem("native-hitl-session");
  $("notice").textContent = error.message;
}

