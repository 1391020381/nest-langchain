import { Injectable, type OnModuleInit } from "@nestjs/common";
import { LocalEmbeddings } from "@autix/llm-core";

@Injectable()
export class ChatEmbeddingService implements OnModuleInit {
  private initialization?: Promise<void>;

  constructor(private readonly local: LocalEmbeddings) {}

  onModuleInit(): Promise<void> {
    return this.waitUntilReady();
  }

  waitUntilReady(): Promise<void> {
    this.initialization ??= this.local.init();
    return this.initialization;
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
