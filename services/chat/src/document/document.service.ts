import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { parseFileContent, splitText } from "@autix/llm-core";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import {
  basename,
  extname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
} from "node:path";
import { ChatEmbeddingService } from "../embedding/chat-embedding.service";
import { PrismaService } from "../prisma/prisma.service";

const ALLOWED_EXTENSIONS = new Set([".pdf", ".txt", ".md"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

export function assertProcessable(status: string): void {
  if (status === "processing" || status === "completed") {
    throw new ConflictException("Document is already processing or completed");
  }
}

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: ChatEmbeddingService,
  ) {}

  async upload(userId: string, file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    const extension = extname(file.originalname).toLowerCase();
    if (
      !ALLOWED_EXTENSIONS.has(extension) &&
      !ALLOWED_MIME_TYPES.has(file.mimetype)
    ) {
      throw new BadRequestException("Only PDF, TXT, and MD files are allowed");
    }

    const safeOriginalName = basename(file.originalname).replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
    const document = await this.prisma.document.create({
      data: {
        userId,
        filename: "",
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        status: "pending",
      },
    });
    const relativeFilename = posix.join(
      "uploads",
      userId,
      `${document.id}-${safeOriginalName}`,
    );
    const absoluteFilename = join(process.cwd(), ...relativeFilename.split("/"));

    try {
      await mkdir(join(process.cwd(), "uploads", userId), { recursive: true });
      await writeFile(absoluteFilename, file.buffer);
      return await this.prisma.document.update({
        where: { id: document.id },
        data: { filename: relativeFilename },
      });
    } catch (error) {
      await unlink(absoluteFilename).catch(() => undefined);
      await this.prisma.document
        .delete({ where: { id: document.id } })
        .catch(() => undefined);
      throw error;
    }
  }

  list(userId: string) {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOwnedOrThrow(userId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, userId },
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    return document;
  }

  async claimForProcessing(userId: string, documentId: string): Promise<void> {
    const result = await this.prisma.document.updateMany({
      where: {
        id: documentId,
        userId,
        status: { in: ["pending", "failed"] },
      },
      data: { status: "processing" },
    });

    if (result.count > 0) {
      return;
    }

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new NotFoundException("Document not found");
    }
    throw new ConflictException("Document is already processing or completed");
  }

  async parseAndChunk(userId: string, documentId: string) {
    const document = await this.getOwnedOrThrow(userId, documentId);
    assertProcessable(document.status);

    const uploadsDirectory = resolve(process.cwd(), "uploads");
    const absoluteFilename = resolve(process.cwd(), document.filename);
    const pathWithinUploads = relative(uploadsDirectory, absoluteFilename);
    if (pathWithinUploads.startsWith("..") || isAbsolute(pathWithinUploads)) {
      throw new BadRequestException("Document file path is invalid");
    }

    const buffer = await readFile(absoluteFilename);
    const text = await parseFileContent(
      buffer,
      document.mimeType,
      document.originalName,
    );
    const chunks = await splitText(text);

    return this.prisma.$transaction(async (transaction) => {
      await transaction.documentChunk.deleteMany({
        where: { documentId },
      });
      if (chunks.length > 0) {
        await transaction.documentChunk.createMany({
          data: chunks.map((content, chunkIndex) => ({
            documentId,
            content,
            chunkIndex,
          })),
        });
      }
      return transaction.document.update({
        where: { id: documentId },
        data: { chunkCount: chunks.length },
      });
    });
  }

  async processDocumentAfterClaim(
    userId: string,
    documentId: string,
  ): Promise<void> {
    const document = await this.getOwnedOrThrow(userId, documentId);

    try {
      const chunks = await this.readAndSplitDocument(document);
      await this.prisma.documentChunk.deleteMany({ where: { documentId } });

      const chunkRows = [];
      for (const [chunkIndex, content] of chunks.entries()) {
        chunkRows.push(
          await this.prisma.documentChunk.create({
            data: { documentId, content, chunkIndex },
          }),
        );
      }

      await this.embeddings.waitUntilReady();
      const vectors = await this.embeddings.embedDocuments(chunks);
      if (vectors.length !== chunkRows.length) {
        throw new Error("Embedding count does not match document chunk count");
      }

      for (const [index, embedding] of vectors.entries()) {
        const vector = this.toVectorString(embedding);
        await this.prisma.$executeRawUnsafe(
          'UPDATE "DocumentChunk" SET embedding = $1::vector WHERE id = $2',
          vector,
          chunkRows[index].id,
        );
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: "completed", chunkCount: chunks.length },
      });
    } catch (error) {
      await this.prisma.documentChunk.deleteMany({ where: { documentId } });
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: "failed", chunkCount: 0 },
      });
      throw error;
    }
  }

  private async readAndSplitDocument(document: {
    filename: string;
    mimeType: string;
    originalName: string;
  }): Promise<string[]> {
    const uploadsDirectory = resolve(process.cwd(), "uploads");
    const absoluteFilename = resolve(process.cwd(), document.filename);
    const pathWithinUploads = relative(uploadsDirectory, absoluteFilename);
    if (pathWithinUploads.startsWith("..") || isAbsolute(pathWithinUploads)) {
      throw new BadRequestException("Document file path is invalid");
    }
    const buffer = await readFile(absoluteFilename);
    const text = await parseFileContent(
      buffer,
      document.mimeType,
      document.originalName,
    );
    return splitText(text);
  }

  private toVectorString(embedding: number[]): string {
    if (
      embedding.length === 0 ||
      embedding.some((value) => !Number.isFinite(value))
    ) {
      throw new Error("Embedding vector must contain finite numbers");
    }
    return `[${embedding.join(",")}]`;
  }
}
