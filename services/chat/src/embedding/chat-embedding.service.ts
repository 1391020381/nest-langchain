import { Injectable, type OnModuleInit } from "@nestjs/common";
import { LocalEmbeddings } from "@autix/llm-core";

@Injectable()
export class ChatEmbeddingService implements OnModuleInit {
  private initialization?: Promise<void>;

  constructor(private readonly local: LocalEmbeddings) {}

  onModuleInit(): void {
    // Non-blocking warm-up: do not delay Nest listen on slow/failed download.
    void this.waitUntilReady().catch((err) => {
      console.error("[ChatEmbeddingService] warm-up failed:", err);
    });
  }

  waitUntilReady(): Promise<void> {
    this.initialization ??= this.local.init();
    return this.initialization;
  }

  assertReady(): void {
    this.local.assertReady();
  }

  async embedQuery(text: string): Promise<number[]> {
    await this.waitUntilReady();
    return this.local.embedQuery(text);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    await this.waitUntilReady();
    return this.local.embedDocuments(documents);
  }
}
