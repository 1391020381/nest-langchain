import { Controller, Headers, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ModelDiagnosticResponse } from "@autix/requirement-deepagent-contracts";
import { ModelDiagnosticsService } from "./model-diagnostics.service";

@Controller("api/diagnostics")
export class ModelDiagnosticsController {
  constructor(private readonly diagnostics: ModelDiagnosticsService) {}

  @Post("model")
  diagnoseModel(
    @Headers("x-trace-id") incomingTraceId?: string,
  ): Promise<ModelDiagnosticResponse> {
    const traceId = incomingTraceId?.trim() || randomUUID();
    return this.diagnostics.diagnose(traceId);
  }
}
