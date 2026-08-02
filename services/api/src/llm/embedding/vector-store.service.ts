import { Injectable } from "@nestjs/common";
import { Document } from "@langchain/core/documents";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { EmbeddingService } from "./embedding.service";

/** Minimal Embeddings adapter for MemoryVectorStore */
class NestEmbeddingsAdapter {
  constructor(private readonly embedding: EmbeddingService) {}
  embedQuery(text: string) {
    return this.embedding.embedQuery(text);
  }
  embedDocuments(documents: string[]) {
    return this.embedding.embedDocuments(documents);
  }
}

@Injectable()
export class VectorStoreService {
  private store: MemoryVectorStore | null = null;

  constructor(private readonly embedding: EmbeddingService) {}

  private getStore() {
    if (!this.store) {
      this.store = new MemoryVectorStore(
        new NestEmbeddingsAdapter(this.embedding) as any
      );
    }
    return this.store;
  }

  async addDocuments(
    docs: { content: string; metadata: Record<string, unknown> }[]
  ) {
    const documents = docs.map(
      (d) => new Document({ pageContent: d.content, metadata: d.metadata })
    );
    await this.getStore().addDocuments(documents);
    return { added: documents.length };
  }

  async similaritySearch(query: string, topK: number) {
    const results = await this.getStore().similaritySearch(query, topK);
    return results.map((doc) => ({
      content: doc.pageContent,
      metadata: doc.metadata as Record<string, unknown>,
    }));
  }
}
