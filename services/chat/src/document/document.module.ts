import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";

@Module({
  imports: [AuthModule],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
