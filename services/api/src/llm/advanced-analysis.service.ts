import { Injectable } from "@nestjs/common";
import { RunnableMemoryService } from "./memory/runnable-memory.service";
import { OrchestratorService } from "./agents/orchestrator.service";
import { FilesystemService } from "./filesystem/filesystem.service";

@Injectable()
export class AdvancedAnalysisService {
  constructor(
    private readonly memory: RunnableMemoryService,
    private readonly orchestrator: OrchestratorService,
    private readonly files: FilesystemService
  ) {}

  async analyze(sessionId: string, input: string) {
    const history = await this.memory.getHistory(sessionId);
    const enrichedInput = [
      history.length ? `历史上下文：${JSON.stringify(history)}` : "",
      `当前输入：${input}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await this.orchestrator.orchestrate(enrichedInput);

    const needsClarification =
      (result.clarificationQuestions?.length ?? 0) > 0 ||
      result.status === "need_clarification";

    if (!needsClarification && result.fallback == null && result.report) {
      const orderId = result.extract?.orderId ?? "EC20240315001";
      await this.files.writeWorkspaceFile(
        `tickets/${orderId}-analysis.md`,
        result.report
      );
    }

    const aiContent = needsClarification
      ? `需要补充信息：${(result.clarificationQuestions ?? []).join("；")}`
      : (result.report ?? "分析完成");

    await this.memory.appendMessage(sessionId, input, aiContent);
    return result;
  }
}
