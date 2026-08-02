import { Body, Controller, Post } from "@nestjs/common";
import { VectorStoreService } from "./vector-store.service";

@Controller("api/embedding")
export class EmbeddingController {
  constructor(private readonly vectors: VectorStoreService) {}

  @Post("store")
  store(
    @Body()
    body: {
      documents: { content: string; metadata: Record<string, unknown> }[];
    }
  ) {
    return this.vectors.addDocuments(body.documents);
  }

  @Post("search")
  search(@Body() body: { query: string; topK?: number }) {
    return this.vectors.similaritySearch(body.query, body.topK ?? 3);
  }
}
