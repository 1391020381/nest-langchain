import { Body, Controller, Post } from "@nestjs/common";
import { FilesystemService } from "./filesystem.service";

@Controller("api/files")
export class FilesController {
  constructor(private readonly files: FilesystemService) {}

  @Post("file-chat")
  fileChat(@Body() body: { input: string }) {
    return this.files.fileChat(body.input);
  }
}
