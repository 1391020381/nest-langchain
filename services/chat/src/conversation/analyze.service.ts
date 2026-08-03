import { BadRequestException, Injectable } from "@nestjs/common";
import { orchestrate } from "@autix/llm-core";
import { PrismaService } from "../prisma/prisma.service";
import { SearchService } from "../search/search.service";
import { ConversationService } from "./conversation.service";
import { DatabaseChatMessageHistory } from "./db-chat-history";

export function buildAnalyzeInput(args: {
  historyText: string;
  retrieved: string[];
  input: string;
}): string {
  const parts = [
    args.historyText ? `历史对话：\n${args.historyText}` : "",
    args.retrieved.length
      ? `相关文档：\n${args.retrieved.join("\n---\n")}`
      : "",
    `用户输入：\n${args.input}`,
  ].filter(Boolean);

  return parts.join("\n\n");
}

@Injectable()
export class AnalyzeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationService,
    private readonly search: SearchService,
  ) {}

  async analyze(userId: string, conversationId: string, input: string) {
    if (typeof input !== "string" || !input.trim()) {
      throw new BadRequestException("Input is required");
    }

    await this.conversations.getOwnedOrThrow(userId, conversationId);

    const history = new DatabaseChatMessageHistory(
      this.prisma,
      conversationId,
    );
    const messages = await history.getMessages();
    const retrieved = await this.search.similaritySearch(input, userId, 3);
    const historyText = messages
      .map((message) => `${message.getType()}: ${message.content}`)
      .join("\n");
    const enrichedInput = buildAnalyzeInput({
      historyText,
      retrieved: retrieved.map((document) => document.content),
      input,
    });

    const result = await orchestrate(enrichedInput);
    await history.addMessage("human", input);

    const aiContent =
      result.status === "need_clarification"
        ? result.clarificationQuestions.join("\n")
        : (result.report ?? result.error ?? "");
    await history.addMessage("ai", aiContent, {
      usedAgents: result.usedAgents,
      status: result.status,
    });

    return {
      ...result,
      retrievedDocuments: retrieved,
    };
  }
}
