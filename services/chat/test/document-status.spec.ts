import { afterEach, describe, expect, mock, test } from "bun:test";
import { ConflictException } from "@nestjs/common";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { DocumentController } from "../src/document/document.controller";
import { assertProcessable } from "../src/document/document.service";
import { DocumentService } from "../src/document/document.service";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("process guard", () => {
  test("allows pending documents", () => {
    expect(() => assertProcessable("pending")).not.toThrow();
  });

  test.each(["processing", "completed"])(
    "rejects %s documents with 409",
    (status) => {
      try {
        assertProcessable(status);
        throw new Error("Expected assertProcessable to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).getStatus()).toBe(409);
      }
    },
  );
});

describe("DocumentService.parseAndChunk", () => {
  test("replaces chunks and updates chunkCount without changing status", async () => {
    const uploadsDirectory = join(process.cwd(), "uploads");
    await mkdir(uploadsDirectory, { recursive: true });
    const directory = await mkdtemp(join(uploadsDirectory, "parse-test-"));
    tempDirectories.push(directory);
    const filename = join(directory, "document.txt");
    await writeFile(filename, "A focused document parsing test.");

    const document = {
      id: "document-1",
      userId: "user-1",
      filename: relative(process.cwd(), filename).replaceAll("\\", "/"),
      originalName: "document.txt",
      mimeType: "text/plain",
      status: "pending",
    };
    const findFirst = mock(async () => document);
    const deleteMany = mock(async () => ({ count: 1 }));
    const createMany = mock(async () => ({ count: 1 }));
    const update = mock(async () => ({ ...document, chunkCount: 1 }));
    const prisma = {
      document: { findFirst, update },
      documentChunk: { deleteMany, createMany },
      $transaction: async (callback: (tx: unknown) => unknown) =>
        callback(prisma),
    };
    const service = new DocumentService(prisma as never);

    const result = await service.parseAndChunk("user-1", "document-1");

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "document-1", userId: "user-1" },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { documentId: "document-1" },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          documentId: "document-1",
          content: "A focused document parsing test.",
          chunkIndex: 0,
        },
      ],
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "document-1" },
      data: { chunkCount: 1 },
    });
    expect(result).toEqual({ ...document, chunkCount: 1 });
  });
});

describe("DocumentService.processDocument", () => {
  test("writes embeddings and marks the document completed", async () => {
    const uploadsDirectory = join(process.cwd(), "uploads");
    await mkdir(uploadsDirectory, { recursive: true });
    const directory = await mkdtemp(join(uploadsDirectory, "process-test-"));
    tempDirectories.push(directory);
    const filename = join(directory, "document.txt");
    await writeFile(filename, "A document ready for embedding.");
    const document = {
      id: "document-1",
      userId: "user-1",
      filename: relative(process.cwd(), filename).replaceAll("\\", "/"),
      originalName: "document.txt",
      mimeType: "text/plain",
      status: "pending",
    };
    const update = mock(async ({ data }: { data: Record<string, unknown> }) => ({
      ...document,
      ...data,
    }));
    const executeRaw = mock(async () => 1);
    const embeddings = {
      waitUntilReady: mock(async () => undefined),
      embedDocuments: mock(async () => [[0.1, -0.2, 0.3]]),
    };
    const service = new DocumentService(
      {
        document: { findFirst: mock(async () => document), update },
        documentChunk: {
          deleteMany: mock(async () => ({ count: 0 })),
          create: mock(async ({ data }) => ({ id: "chunk-1", ...data })),
        },
        $executeRawUnsafe: executeRaw,
      } as never,
      embeddings as never,
    );

    await service.processDocument("user-1", "document-1");

    expect(embeddings.waitUntilReady).toHaveBeenCalledTimes(1);
    expect(embeddings.embedDocuments).toHaveBeenCalledWith([
      "A document ready for embedding.",
    ]);
    expect(executeRaw).toHaveBeenCalledWith(
      'UPDATE "DocumentChunk" SET embedding = $1::vector WHERE id = $2',
      "[0.1,-0.2,0.3]",
      "chunk-1",
    );
    expect(update.mock.calls.map(([input]) => input.data)).toEqual([
      { status: "processing" },
      { status: "completed", chunkCount: 1 },
    ]);
  });

  test("cleans partial chunks and marks the document failed", async () => {
    const document = {
      id: "document-1",
      userId: "user-1",
      filename: "uploads/missing.txt",
      originalName: "missing.txt",
      mimeType: "text/plain",
      status: "pending",
    };
    const update = mock(async ({ data }: { data: Record<string, unknown> }) => ({
      ...document,
      ...data,
    }));
    const deleteMany = mock(async () => ({ count: 1 }));
    const service = new DocumentService(
      {
        document: { findFirst: mock(async () => document), update },
        documentChunk: { deleteMany },
      } as never,
      { waitUntilReady: mock(async () => undefined) } as never,
    );

    await expect(
      service.processDocument("user-1", "document-1"),
    ).rejects.toThrow();
    expect(deleteMany).toHaveBeenCalledWith({
      where: { documentId: "document-1" },
    });
    expect(update.mock.calls.map(([input]) => input.data)).toEqual([
      { status: "processing" },
      { status: "failed", chunkCount: 0 },
    ]);
  });
});

describe("DocumentController.process", () => {
  test("validates ownership before accepting background processing", async () => {
    const document = { id: "document-1", status: "pending" };
    const getOwnedOrThrow = mock(async () => document);
    const processDocument = mock(async () => undefined);
    const controller = new DocumentController({
      getOwnedOrThrow,
      processDocument,
    } as never);

    const response = await controller.process(
      { userId: "user-1", email: "user@example.com", role: "user" },
      "document-1",
    );

    expect(response).toEqual({ accepted: true, documentId: "document-1" });
    expect(getOwnedOrThrow).toHaveBeenCalledWith("user-1", "document-1");
    expect(processDocument).toHaveBeenCalledWith("user-1", "document-1");
  });
});
