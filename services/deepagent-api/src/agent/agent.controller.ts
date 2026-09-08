import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  AgentRunRequestSchema,
  encodeSseEvent,
} from "@autix/deepagent-contracts";
import type { Request, Response } from "express";
import { AgentService } from "./agent.service";
import { REQUIREMENT_SUBAGENT_NAMES } from "./subagents/requirement.subagents";

@Controller("api/agent")
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(private readonly agentService: AgentService) {}

  @Get("info")
  info() {
    return {
      name: "requirement-coordinator",
      architecture: "deepagent-first",
      backend: "StateBackend",
      persistence: "single-run only",
      subagents: [...REQUIREMENT_SUBAGENT_NAMES],
    };
  }

  @Post("runs/stream")
  async stream(
    @Body() body: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    this.logger.log(
      `POST /api/agent/runs/stream received contentLength=${request.get("content-length") ?? "unknown"}`,
    );
    const parsed = AgentRunRequestSchema.safeParse(body);
    if (!parsed.success) {
      this.logger.warn(
        `POST /api/agent/runs/stream rejected issues=${parsed.error.issues.length}`,
      );
      throw new BadRequestException({
        message: "请求参数无效",
        issues: parsed.error.issues,
      });
    }

    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();

    const cancellation = new AbortController();
    const cancel = () => cancellation.abort();
    request.once("aborted", cancel);
    response.once("close", cancel);

    try {
      for await (const event of this.agentService.stream(
        parsed.data,
        cancellation.signal,
      )) {
        if (cancellation.signal.aborted) break;
        response.write(encodeSseEvent(event));
      }
    } finally {
      request.off("aborted", cancel);
      response.off("close", cancel);
      if (!response.writableEnded && !response.destroyed) response.end();
    }
  }
}
