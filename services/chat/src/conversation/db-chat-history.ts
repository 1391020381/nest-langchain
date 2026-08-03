import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";

export type ChatMessageRole = "human" | "ai" | "system" | "tool";

export class DatabaseChatMessageHistory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationId: string,
  ) {}

  async getMessages(): Promise<BaseMessage[]> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId: this.conversationId },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((row) => {
      if (row.role === "human") return new HumanMessage(row.content);
      if (row.role === "ai") return new AIMessage(row.content);
      return new SystemMessage(row.content);
    });
  }

  async addMessage(
    role: ChatMessageRole,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.message.create({
      data: {
        conversationId: this.conversationId,
        role,
        content,
        metadata: metadata as Prisma.InputJsonObject | undefined,
      },
    });
  }
}
