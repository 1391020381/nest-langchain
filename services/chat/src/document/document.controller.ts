import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  CurrentUser,
  type CurrentUserData,
} from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DocumentService } from "./document.service";

@Controller("api/documents")
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documentService.upload(user.userId, file);
  }

  @Get()
  list(@CurrentUser() user: CurrentUserData) {
    return this.documentService.list(user.userId);
  }

  @Get(":id")
  get(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
  ) {
    return this.documentService.getOwnedOrThrow(user.userId, id);
  }
}
