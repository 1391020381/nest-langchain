import { describe, expect, test } from "bun:test";
import { firstValueFrom, take, toArray } from "rxjs";
import { SseService } from "../src/sse/sse.service";

describe("SseService", () => {
  test("streams only new events for the subscribed user", async () => {
    const service = new SseService();
    service.publish("user-1", {
      type: "processing",
      documentId: "old-document",
    });

    const received = firstValueFrom(
      service.stream("user-1").pipe(take(2), toArray()),
    );
    service.publish("user-2", {
      type: "error",
      documentId: "other-document",
      message: "not visible",
    });
    service.publish("user-1", {
      type: "processing",
      documentId: "document-1",
    });
    service.publish("user-1", {
      type: "done",
      documentId: "document-1",
    });

    expect(await received).toEqual([
      {
        data: JSON.stringify({
          type: "processing",
          documentId: "document-1",
        }),
      },
      {
        data: JSON.stringify({
          type: "done",
          documentId: "document-1",
        }),
      },
    ]);
  });
});
