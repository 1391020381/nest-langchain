import { Body, Controller, Post } from "@nestjs/common";
import { AdvancedAnalysisService } from "./advanced-analysis.service";

@Controller("api/advanced")
export class AdvancedController {
  constructor(private readonly analysis: AdvancedAnalysisService) {}

  @Post("analyze")
  analyze(@Body() body: { sessionId: string; input: string }) {
    return this.analysis.analyze(body.sessionId, body.input);
  }
}
