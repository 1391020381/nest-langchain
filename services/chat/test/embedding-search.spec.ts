import { describe, expect, mock, test } from "bun:test";
import { ChatEmbeddingService } from "../src/embedding/chat-embedding.service";
import { SearchController } from "../src/search/search.controller";
import { SearchService } from "../src/search/search.service";

describe("ChatEmbeddingService", () => {
  test("initializes once and waits before embedding documents", async () => {
    let releaseInitialization!: () => void;
    const initialization = new Promise<void>((resolve) => {
      releaseInitialization = resolve;
    });
    const local = {
      init: mock(() => initialization),
      embedDocuments: mock(async (documents: string[]) =>
        documents.map(() => [0.1, 0.2]),
      ),
      embedQuery: mock(async () => [0.1, 0.2]),
    };
    const service = new ChatEmbeddingService(local as never);

    const moduleInitialization = service.onModuleInit();
    const embedding = service.embedDocuments(["chunk"]);
    expect(local.embedDocuments).not.toHaveBeenCalled();

    releaseInitialization();
    await moduleInitialization;
    expect(await embedding).toEqual([[0.1, 0.2]]);
    expect(local.init).toHaveBeenCalledTimes(1);
  });
});

describe("SearchService", () => {
  test("queries only completed documents owned by the user", async () => {
    const rows = [
      {
        content: "refunds take seven days",
        documentId: "document-1",
        chunkIndex: 2,
        score: 0.91,
      },
    ];
    const queryRaw = mock(async () => rows);
    const prisma = { $queryRawUnsafe: queryRaw };
    const embeddings = {
      embedQuery: mock(async () => [0.25, -0.5, 1]),
    };
    const service = new SearchService(prisma as never, embeddings as never);

    const result = await service.similaritySearch("refund period", "user-1", 5);

    expect(result).toEqual(rows);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const [sql, vector, userId, topK] = queryRaw.mock.calls[0] as unknown as [
      string,
      string,
      string,
      number,
    ];
    expect(sql).toContain('d."userId" = $2');
    expect(sql).toContain("d.status = 'completed'");
    expect(sql).toContain("dc.embedding IS NOT NULL");
    expect(vector).toBe("[0.25,-0.5,1]");
    expect(userId).toBe("user-1");
    expect(topK).toBe(5);
  });

  test("rejects a non-finite embedding before building SQL parameters", async () => {
    const queryRaw = mock(async () => []);
    const service = new SearchService(
      { $queryRawUnsafe: queryRaw } as never,
      { embedQuery: mock(async () => [Number.NaN]) } as never,
    );

    await expect(
      service.similaritySearch("query", "user-1"),
    ).rejects.toThrow("finite numbers");
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

describe("SearchController", () => {
  test("passes the authenticated user and request body to search", async () => {
    const similaritySearch = mock(async () => []);
    const controller = new SearchController({ similaritySearch } as never);

    await controller.search(
      { userId: "user-1", email: "user@example.com", role: "user" },
      { query: "refund period", topK: 4 },
    );

    expect(similaritySearch).toHaveBeenCalledWith(
      "refund period",
      "user-1",
      4,
    );
  });
});
