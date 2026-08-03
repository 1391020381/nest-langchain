import { BadRequestException, Injectable } from "@nestjs/common";
import { ChatEmbeddingService } from "../embedding/chat-embedding.service";
import { PrismaService } from "../prisma/prisma.service";

export interface SearchResult {
  content: string;
  documentId: string;
  chunkIndex: number;
  score?: number;
}

function toVectorString(embedding: number[]): string {
  if (
    embedding.length === 0 ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("Embedding vector must contain finite numbers");
  }
  return `[${embedding.join(",")}]`;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: ChatEmbeddingService,
  ) {}

  async similaritySearch(
    query: string,
    userId: string,
    topK = 3,
  ): Promise<SearchResult[]> {
    if (!query?.trim()) {
      throw new BadRequestException("Query is required");
    }
    if (!Number.isInteger(topK) || topK < 1 || topK > 100) {
      throw new BadRequestException("topK must be an integer between 1 and 100");
    }

    const vector = toVectorString(await this.embeddings.embedQuery(query));
    return this.prisma.$queryRawUnsafe<SearchResult[]>(
      `SELECT dc.content, dc."documentId", dc."chunkIndex",
              1 - (dc.embedding <=> $1::vector) AS score
       FROM "DocumentChunk" dc
       INNER JOIN "Document" d ON d.id = dc."documentId"
       WHERE d."userId" = $2
         AND dc.embedding IS NOT NULL
         AND d.status = 'completed'
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $3`,
      vector,
      userId,
      topK,
    );
  }
}
