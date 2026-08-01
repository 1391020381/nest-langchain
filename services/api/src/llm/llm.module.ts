import { Module } from "@nestjs/common";
import { LlmService } from "./llm.service";
import { RequirementService } from "./requirement.service";

@Module({
  providers: [LlmService, RequirementService],
  exports: [LlmService, RequirementService],
})
export class LlmModule {}
