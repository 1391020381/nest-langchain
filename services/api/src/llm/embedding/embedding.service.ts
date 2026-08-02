import { Injectable, OnModuleInit } from "@nestjs/common";
import { env, pipeline } from "@xenova/transformers";

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private embedder: any;
  private ready = false;

  onModuleInit() {
    // huggingface.co is often unreachable in CN; override via HF_ENDPOINT.
    const endpoint = process.env.HF_ENDPOINT ?? "https://hf-mirror.com";
    env.remoteHost = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;

    // Non-blocking warm-up: do not delay Nest listen on slow/failed download.
    void this.warmUp().catch((err) => {
      console.error("[EmbeddingService] warm-up failed:", err);
      this.ready = false;
    });
  }

  private async warmUp() {
    this.embedder = await pipeline(
      "feature-extraction",
      "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
    );
    this.ready = true;
  }

  assertReady() {
    if (!this.ready) {
      throw new Error("Embedding model is not ready");
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    this.assertReady();
    const output = await this.embedder(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const doc of documents) {
      results.push(await this.embedQuery(doc));
    }
    return results;
  }
}
