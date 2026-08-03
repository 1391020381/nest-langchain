import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, posix } from "node:path";
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
  constructor(private readonly prisma: PrismaService) {}

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
}
