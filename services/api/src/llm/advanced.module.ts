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
import { AdvancedAnalysisService } from "./advanced-analysis.service";
import { AdvancedController } from "./advanced.controller";

@Module({
  controllers: [
    MemoryController,
    FilesController,
    EmbeddingController,
    AgentsController,
    AdvancedController,
  ],
  providers: [
    RunnableMemoryService,
    FilesystemService,
    EmbeddingService,
    VectorStoreService,
    OrchestratorService,
    AdvancedAnalysisService,
  ],
  exports: [
    RunnableMemoryService,
    FilesystemService,
    EmbeddingService,
    VectorStoreService,
    OrchestratorService,
    AdvancedAnalysisService,
  ],
})
export class AdvancedModule {}
