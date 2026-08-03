import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentUser,
  type CurrentUserData,
} from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ConversationService } from "./conversation.service";

interface CreateConversationBody {
  title?: string;
}

@Controller("api/conversations")
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: CurrentUserData,
    @Body() body: CreateConversationBody,
  ) {
    return this.conversationService.create(user.userId, body.title);
  }

  @Get()
  list(@CurrentUser() user: CurrentUserData) {
    return this.conversationService.list(user.userId);
  }

  @Get(":id/messages")
  listMessages(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
  ) {
    return this.conversationService.listMessages(user.userId, id);
  }
}
