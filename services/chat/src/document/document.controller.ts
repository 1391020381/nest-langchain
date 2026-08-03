import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MulterError } from "multer";
import {
  CurrentUser,
  type CurrentUserData,
} from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DocumentService } from "./document.service";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

@Catch(MulterError)
class UploadMulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const message =
      exception.code === "LIMIT_FILE_SIZE"
        ? "File exceeds 10MB limit"
        : exception.message;
    const response = host.switchToHttp().getResponse();
    const error = new BadRequestException(message).getResponse();
    response.status(400).json(error);
  }
}

@Controller("api/documents")
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post("upload")
  @UseFilters(new UploadMulterExceptionFilter())
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_UPLOAD_SIZE },
    }),
  )
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

  @Post(":id/process")
  @HttpCode(HttpStatus.ACCEPTED)
  async process(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
  ) {
    await this.documentService.claimForProcessing(user.userId, id);
    void this.documentService
      .processDocumentAfterClaim(user.userId, id)
      .catch(() => undefined);
    return { accepted: true, documentId: id };
  }
}
