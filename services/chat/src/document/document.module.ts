import { Module } from "@nestjs/common";
import { LocalEmbeddings } from "@autix/llm-core";
import { AuthModule } from "../auth/auth.module";
import { ChatEmbeddingService } from "../embedding/chat-embedding.service";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";

@Module({
  imports: [AuthModule],
  controllers: [DocumentController],
  providers: [LocalEmbeddings, ChatEmbeddingService, DocumentService],
  exports: [ChatEmbeddingService, DocumentService],
})
export class DocumentModule {}
