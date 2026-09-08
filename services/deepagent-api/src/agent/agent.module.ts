import { Module } from "@nestjs/common";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { AGENT_RUNTIME } from "./agent.tokens";
import { DeepAgentRuntime } from "./deepagent.runtime";

@Module({
  controllers: [AgentController],
  providers: [
    AgentService,
    DeepAgentRuntime,
    { provide: AGENT_RUNTIME, useExisting: DeepAgentRuntime },
  ],
})
export class AgentModule {}
