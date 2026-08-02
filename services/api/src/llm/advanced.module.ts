import { Module } from "@nestjs/common";
import { RunnableMemoryService } from "./memory/runnable-memory.service";
import { MemoryController } from "./memory/memory.controller";
import { FilesystemService } from "./filesystem/filesystem.service";
import { FilesController } from "./filesystem/files.controller";

@Module({
  controllers: [MemoryController, FilesController],
  providers: [RunnableMemoryService, FilesystemService],
  exports: [RunnableMemoryService, FilesystemService],
})
export class AdvancedModule {}
