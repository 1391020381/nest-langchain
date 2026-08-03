import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DocumentModule } from "../document/document.module";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  imports: [AuthModule, DocumentModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
