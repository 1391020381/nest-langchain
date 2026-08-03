import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ConversationModule } from "./conversation/conversation.module";
import { DocumentModule } from "./document/document.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, AuthModule, ConversationModule, DocumentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
