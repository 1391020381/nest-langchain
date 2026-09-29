import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { afterEach, describe, test } from "node:test";

import { createApp } from "./server";
import { HttpError, NativeApprovalSessions } from "./sessions";

describe("原生 LangGraph HITL 前后端", () => {
  const servers: Server[] = [];
  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
    );
  });

  test("会话通过 API 暂停、批准并完成，重复审批被拒绝", async () => {
    const app = createApp();
    servers.push(app);
    app.listen(0, "127.0.0.1");
    await once(app, "listening");
    const address = app.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;

    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /原生 LangGraph 人工审批/);

    const createdResponse = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: "发送发布通知" }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()) as {
      id: string;
      revision: number;
      status: string;
      pending: { value: { kind: string } };
      outbox: unknown[];
    };
    assert.equal(created.status, "interrupted");
    assert.equal(created.pending.value.kind, "email_approval");
    assert.equal(created.outbox.length, 0);

    const resumeBody = {
      revision: created.revision,
      decision: { type: "approve" },
    };
    const resumedResponse = await fetch(
      `${base}/api/sessions/${created.id}/resume`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resumeBody),
      },
    );
    assert.equal(resumedResponse.status, 200);
    const resumed = (await resumedResponse.json()) as {
      status: string;
      outbox: unknown[];
    };
    assert.equal(resumed.status, "completed");
    assert.equal(resumed.outbox.length, 1);

    const duplicate = await fetch(
      `${base}/api/sessions/${created.id}/resume`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resumeBody),
      },
    );
    assert.equal(duplicate.status, 409);
  });

  test("会话层支持修改与拒绝决策", async () => {
    const sessions = new NativeApprovalSessions();
    const edited = await sessions.create("发送通知");
    const editedFinal = await sessions.resume(edited.id, {
      revision: edited.revision,
      decision: {
        type: "edit",
        action: {
          to: "owner@example.com",
          subject: "人工修改",
          body: "修改后的正文",
        },
      },
    });
    assert.equal(editedFinal.status, "completed");
    assert.equal(editedFinal.outbox[0].to, "owner@example.com");

    const rejected = await sessions.create("另一个通知");
    const rejectedFinal = await sessions.resume(rejected.id, {
      revision: rejected.revision,
      decision: { type: "reject", reason: "内容需要重写" },
    });
    assert.equal(rejectedFinal.status, "rejected");
    assert.equal(rejectedFinal.outbox.length, 0);

    await assert.rejects(
      () =>
        sessions.resume(rejected.id, {
          revision: rejected.revision,
          decision: { type: "approve" },
        }),
      (error: unknown) => error instanceof HttpError && error.status === 409,
    );
  });
});

