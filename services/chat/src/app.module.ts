import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ConversationModule } from "./conversation/conversation.module";
import { DocumentModule } from "./document/document.module";
import { UiChatModule } from "./llm/ui-protocol/ui-chat.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SearchModule } from "./search/search.module";
import { SseModule } from "./sse/sse.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ConversationModule,
    DocumentModule,
    SearchModule,
    SseModule,
    UiChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
