import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Post,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { LlmService } from "./llm.service";

@Controller("api/langchain")
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  private requireInput(body: { input?: string }): string {
    if (!body?.input?.trim()) {
      throw new BadRequestException("input is required");
    }
    return body.input.trim();
  }

  private requireInputs(body: { inputs?: string[] }): string[] {
    if (!Array.isArray(body?.inputs) || body.inputs.length === 0) {
      throw new BadRequestException("inputs is required");
    }
    const inputs = body.inputs
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
    if (inputs.length === 0) {
      throw new BadRequestException("inputs is required");
    }
    return inputs;
  }

  private wrapError(error: unknown, fallback: string): never {
    const message = error instanceof Error ? error.message : fallback;
    throw new InternalServerErrorException(message);
  }

  @Post("prompt-preview")
  async promptPreview(@Body() body: { input?: string }) {
    const input = this.requireInput(body);
    try {
      return await this.llmService.promptPreview(input);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.wrapError(error, "prompt-preview failed");
    }
  }

  @Post("batch")
  async batch(@Body() body: { inputs?: string[] }) {
    const inputs = this.requireInputs(body);
    try {
      const results = await this.llmService.batchDemo(inputs);
      return { results };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.wrapError(error, "batch failed");
    }
  }
}
