import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from "@nestjs/common";
import { RequirementSchema } from "@autix/contracts";
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
  async extract(@Body() body: unknown) {
    const parsed = RequirementSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "invalid requirement input",
        issues: parsed.error.issues,
      });
    }
    return this.requirementService.extract(parsed.data.input);
  }
}
