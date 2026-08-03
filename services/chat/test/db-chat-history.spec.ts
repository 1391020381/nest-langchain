import { describe, expect, mock, test } from "bun:test";
import { NotFoundException } from "@nestjs/common";
import { DatabaseChatMessageHistory } from "../src/conversation/db-chat-history";
import { ConversationService } from "../src/conversation/conversation.service";

describe("DatabaseChatMessageHistory", () => {
  test("returns persisted messages in chronological order as LangChain messages", async () => {
    const findMany = mock(async () => [
      { role: "human", content: "hello" },
      { role: "ai", content: "hi" },
      { role: "system", content: "be concise" },
      { role: "tool", content: "tool result" },
    ]);
    const prisma = { message: { findMany } };
    const history = new DatabaseChatMessageHistory(
      prisma as never,
      "conversation-1",
    );

    const messages = await history.getMessages();

    expect(findMany).toHaveBeenCalledWith({
      where: { conversationId: "conversation-1" },
      orderBy: { createdAt: "asc" },
    });
    expect(
      messages.map((message) => [message.getType(), message.content]),
    ).toEqual([
      ["human", "hello"],
      ["ai", "hi"],
      ["system", "be concise"],
      ["system", "tool result"],
    ]);
  });

  test("persists a message with optional metadata", async () => {
    const create = mock(async () => undefined);
    const prisma = { message: { create } };
    const history = new DatabaseChatMessageHistory(
      prisma as never,
      "conversation-1",
    );

    await history.addMessage("human", "hello", { source: "unit-test" });

    expect(create).toHaveBeenCalledWith({
      data: {
        conversationId: "conversation-1",
        role: "human",
        content: "hello",
        metadata: { source: "unit-test" },
      },
    });
  });
});

describe("ConversationService ownership", () => {
  test("throws 404 when conversation belongs to another user", async () => {
    const findFirst = mock(async () => null);
    const prisma = { conversation: { findFirst } };
    const service = new ConversationService(prisma as never);

    await expect(
      service.getOwnedOrThrow("user-2", "conversation-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "conversation-1", userId: "user-2" },
    });
  });
});
