import { Module } from "@nestjs/common";
import { readRequirementRuntimeConfig } from "../model/model.config";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { DeepAgentRuntime } from "./runtime/deepagent.runtime";
import {
  REQUIREMENT_RUNTIME,
  REQUIREMENT_RUNTIME_CONFIG,
} from "./runtime/runtime.types";

@Module({
  controllers: [AgentController],
  providers: [
    DeepAgentRuntime,
    {
      provide: REQUIREMENT_RUNTIME,
      useExisting: DeepAgentRuntime,
    },
    {
      provide: REQUIREMENT_RUNTIME_CONFIG,
      useFactory: readRequirementRuntimeConfig,
    },
    AgentService,
  ],
})
export class AgentModule {}
