import { Module } from "@nestjs/common";
import { RunnableMemoryService } from "./memory/runnable-memory.service";
import { MemoryController } from "./memory/memory.controller";

@Module({
  controllers: [MemoryController],
  providers: [RunnableMemoryService],
  exports: [RunnableMemoryService],
})
export class AdvancedModule {}
