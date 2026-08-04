import { Body, Controller, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import {
  CurrentUser,
  type CurrentUserData,
} from "../../auth/current-user.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ConversationService } from "../../conversation/conversation.service";
import { formatSse } from "./stream-format";
import { UIChatService } from "./ui-chat.service";
import type { UIAction } from "./ui-types";

@Controller("api/ui-chat")
@UseGuards(JwtAuthGuard)
export class UIChatController {
  constructor(
    private readonly uiChat: UIChatService,
    private readonly conversations: ConversationService,
  ) {}

  @Post(":conversationId/chat")
  chat(
    @CurrentUser() user: CurrentUserData,
    @Param("conversationId") conversationId: string,
    @Body() body: { input: string },
  ) {
    return this.uiChat.chat(user.userId, conversationId, body.input);
  }

  @Post(":conversationId/action")
  action(
    @CurrentUser() user: CurrentUserData,
    @Param("conversationId") conversationId: string,
    @Body() body: { action: UIAction },
  ) {
    return this.uiChat.action(user.userId, conversationId, body.action);
  }

  @Post(":conversationId/analyze/stream")
  async analyzeStream(
    @CurrentUser() user: CurrentUserData,
    @Param("conversationId") conversationId: string,
    @Res() res: Response,
  ) {
    // Ownership before SSE headers so Nest can return HTTP 404.
    await this.conversations.getOwnedOrThrow(user.userId, conversationId);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    try {
      for await (const msg of this.uiChat.analyzeStream(
        user.userId,
        conversationId,
      )) {
        res.write(formatSse(msg));
      }
    } catch (err) {
      res.write(
        formatSse({
          messageType: "error",
          timestamp: new Date().toISOString(),
          payload: {
            message: err instanceof Error ? err.message : "error",
          },
        }),
      );
    } finally {
      res.end();
    }
  }
}
