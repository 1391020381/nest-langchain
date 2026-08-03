import { afterEach, describe, expect, mock, test } from "bun:test";
import { ConflictException } from "@nestjs/common";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
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
