import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SearchModule } from "../search/search.module";
import { AnalyzeService } from "./analyze.service";
import { ConversationController } from "./conversation.controller";
import { ConversationService } from "./conversation.service";

@Module({
  imports: [AuthModule, SearchModule],
  controllers: [ConversationController],
  providers: [AnalyzeService, ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
