import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, title?: string) {
    return this.prisma.conversation.create({
      data: {
        userId,
        ...(title === undefined ? {} : { title }),
      },
    });
  }

  list(userId: string) {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getOwnedOrThrow(userId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    return conversation;
  }

  async listMessages(userId: string, id: string) {
    await this.getOwnedOrThrow(userId, id);

    return this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });
  }
}
