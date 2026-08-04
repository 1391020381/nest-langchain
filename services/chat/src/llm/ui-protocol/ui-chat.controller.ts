import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import {
  CurrentUser,
  type CurrentUserData,
} from "../../auth/current-user.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { UIChatService } from "./ui-chat.service";
import type { UIAction } from "./ui-types";

@Controller("api/ui-chat")
@UseGuards(JwtAuthGuard)
export class UIChatController {
  constructor(private readonly uiChat: UIChatService) {}

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
}
