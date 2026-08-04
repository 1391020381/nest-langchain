import { BadRequestException, Injectable } from "@nestjs/common";
import { ConversationService } from "../../conversation/conversation.service";
import { DatabaseChatMessageHistory } from "../../conversation/db-chat-history";
import { PrismaService } from "../../prisma/prisma.service";
import { UIOrchestrateAdapter } from "./ui-orchestrate.adapter";
import {
  extractCollectedData,
  formatActionContent,
  isConfirmAnalyze,
  mergeCollectedData,
} from "./ui-persistence";
import { UIResponseService } from "./ui-response.service";
import type {
  AIUIResponse,
  AIUIResponseWithStreamHint,
  UIAction,
} from "./ui-types";
import { validateUIResponse } from "./ui-validate";

@Injectable()
export class UIChatService {
  constructor(
    private readonly conversations: ConversationService,
    private readonly prisma: PrismaService,
    private readonly uiResponse: UIResponseService,
    private readonly orchestrateAdapter: UIOrchestrateAdapter,
  ) {}

  async chat(
    userId: string,
    conversationId: string,
    input: string,
  ): Promise<AIUIResponse> {
    if (!input?.trim()) throw new BadRequestException("Input is required");
    await this.conversations.getOwnedOrThrow(userId, conversationId);
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
    const collected = extractCollectedData(rows);
    const history = this.uiResponse.toLangChainHistory(rows);
    const historyDb = new DatabaseChatMessageHistory(this.prisma, conversationId);
    await historyDb.addMessage("human", input);
    const ui = await this.uiResponse.generateUIResponse(
      input,
      history,
      collected,
    );
    const withCtx: AIUIResponse = {
      ...ui,
      context: {
        sessionStage: ui.context?.sessionStage,
        collectedData: { ...collected, ...(ui.context?.collectedData ?? {}) },
      },
    };
    await historyDb.addMessage("ai", withCtx.message, { ui: withCtx });
    return withCtx;
  }

  async action(
    userId: string,
    conversationId: string,
    action: UIAction,
  ): Promise<AIUIResponseWithStreamHint> {
    await this.conversations.getOwnedOrThrow(userId, conversationId);
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
    const collected = mergeCollectedData(extractCollectedData(rows), action);
    const historyDb = new DatabaseChatMessageHistory(this.prisma, conversationId);
    await historyDb.addMessage("human", formatActionContent(action), { action });

    // confirm=true: return streamSuggested only — do not call LLM or orchestrate
    if (isConfirmAnalyze(action)) {
      const ui: AIUIResponse = validateUIResponse({
        version: "1.0",
        message: "已确认，开始分析…",
        components: [
          {
            type: "steps",
            currentStep: 0,
            steps: [
              { label: "准备分析", status: "current" },
              { label: "多智能体处理", status: "pending" },
              { label: "汇总报告", status: "pending" },
            ],
          },
        ],
        context: { sessionStage: "analyzing", collectedData: collected },
      });
      await historyDb.addMessage("ai", ui.message, { ui });
      return { ...ui, streamSuggested: true };
    }

    const prompt = `用户 UI 操作：${JSON.stringify(action)}\n请给出下一步 UI。`;
    const history = this.uiResponse.toLangChainHistory(
      await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
      }),
    );
    const ui = await this.uiResponse.generateUIResponse(
      prompt,
      history,
      collected,
    );
    const withCtx: AIUIResponse = {
      ...ui,
      context: {
        sessionStage: ui.context?.sessionStage,
        collectedData: { ...collected, ...(ui.context?.collectedData ?? {}) },
      },
    };
    await historyDb.addMessage("ai", withCtx.message, { ui: withCtx });
    return withCtx;
  }
}
