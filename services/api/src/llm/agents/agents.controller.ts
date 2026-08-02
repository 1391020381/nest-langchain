import { Body, Controller, Post } from "@nestjs/common";
import { OrchestratorService } from "./orchestrator.service";

@Controller("api/agents")
export class AgentsController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  @Post("orchestrate")
  orchestrate(@Body() body: { input: string }) {
    return this.orchestrator.orchestrate(body.input);
  }
}
