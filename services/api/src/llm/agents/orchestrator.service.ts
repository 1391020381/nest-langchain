import { Injectable } from "@nestjs/common";
import { orchestrate, type OrchestrateResult } from "@autix/llm-core";

export type { OrchestrateResult };

@Injectable()
export class OrchestratorService {
  orchestrate(input: string): Promise<OrchestrateResult> {
    return orchestrate(input);
  }
}
