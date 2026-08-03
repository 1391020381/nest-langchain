import { Injectable, OnModuleInit } from "@nestjs/common";
import { LocalEmbeddings } from "@autix/llm-core";

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly core = new LocalEmbeddings();

  onModuleInit() {
    // Non-blocking warm-up: do not delay Nest listen on slow/failed download.
    void this.core.init().catch((err) => {
      console.error("[EmbeddingService] warm-up failed:", err);
    });
  }

  assertReady() {
    this.core.assertReady();
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.core.embedQuery(text);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return this.core.embedDocuments(documents);
  }
}
