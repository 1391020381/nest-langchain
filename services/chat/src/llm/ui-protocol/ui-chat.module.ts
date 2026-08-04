import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { ConversationModule } from "../../conversation/conversation.module";
import { UIChatController } from "./ui-chat.controller";
import { UIChatService } from "./ui-chat.service";
import { UIOrchestrateAdapter } from "./ui-orchestrate.adapter";
import { UIResponseService } from "./ui-response.service";

@Module({
  imports: [AuthModule, ConversationModule],
  controllers: [UIChatController],
  providers: [UIResponseService, UIOrchestrateAdapter, UIChatService],
})
export class UiChatModule {}
