export class LocalEmbeddings {
  private embedder: any;
  private ready = false;

  async init(): Promise<void> {
    const { env, pipeline } = await import("@xenova/transformers");
    const endpoint = process.env.HF_ENDPOINT ?? "https://hf-mirror.com";
    env.remoteHost = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
    this.embedder = await pipeline(
      "feature-extraction",
      "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
    );
    this.ready = true;
  }

  assertReady(): void {
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
    for (const document of documents) {
      results.push(await this.embedQuery(document));
    }
    return results;
  }
}
