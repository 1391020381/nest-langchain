import { Module } from "@nestjs/common";
import { RunnableMemoryService } from "./memory/runnable-memory.service";
import { MemoryController } from "./memory/memory.controller";
import { FilesystemService } from "./filesystem/filesystem.service";
import { FilesController } from "./filesystem/files.controller";
import { EmbeddingService } from "./embedding/embedding.service";
import { VectorStoreService } from "./embedding/vector-store.service";
import { EmbeddingController } from "./embedding/embedding.controller";
import { OrchestratorService } from "./agents/orchestrator.service";
import { AgentsController } from "./agents/agents.controller";

@Module({
  controllers: [
    MemoryController,
    FilesController,
    EmbeddingController,
    AgentsController,
  ],
  providers: [
    RunnableMemoryService,
    FilesystemService,
    EmbeddingService,
    VectorStoreService,
    OrchestratorService,
  ],
  exports: [
    RunnableMemoryService,
    FilesystemService,
    EmbeddingService,
    VectorStoreService,
    OrchestratorService,
  ],
})
export class AdvancedModule {}
