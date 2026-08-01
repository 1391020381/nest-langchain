import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from "@nestjs/common";
import { AppService } from "./app.service";
import { RequirementService } from "./llm/requirement.service";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly requirementService: RequirementService
  ) {}

  @Get("health")
  getHealth() {
    return this.appService.getHealth();
  }

  @Post("requirement/extract")
  async extract(@Body() body: { input?: string }) {
    if (!body?.input?.trim()) {
      throw new BadRequestException("input is required");
    }
    return this.requirementService.extract(body.input);
  }
}
