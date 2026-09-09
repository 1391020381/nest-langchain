import { once } from "node:events";
import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  REQUIREMENT_INPUT_MAX_CHARS,
  type AgentRunRequest,
  type AgentStreamEvent,
} from "@autix/requirement-deepagent-contracts";
import { AgentService } from "./agent.service";

export function formatSseEvent(event: AgentStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function validateRequest(value: unknown): AgentRunRequest {
  if (!value || typeof value !== "object") {
    throw new BadRequestException("请求体必须是 JSON 对象。");
  }
  const body = value as Record<string, unknown>;
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) throw new BadRequestException("input 不能为空。");
  if (input.length > REQUIREMENT_INPUT_MAX_CHARS) {
    throw new BadRequestException(
      `input 不能超过 ${REQUIREMENT_INPUT_MAX_CHARS} 个字符。`,
    );
  }
  if (body.threadId !== undefined && typeof body.threadId !== "string") {
    throw new BadRequestException("threadId 必须是字符串。");
  }
  return {
    input,
    ...(typeof body.threadId === "string" && body.threadId.trim()
      ? { threadId: body.threadId.trim() }
      : {}),
  };
}

@Controller("api/agent")
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(private readonly agentService: AgentService) {}

  @Post("runs/stream")
  async stream(
    @Body() body: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const runRequest = validateRequest(body);
    const abortController = new AbortController();
    const abort = () => abortController.abort();
    const close = () => {
      if (!response.writableEnded) abort();
    };
    request.once("aborted", abort);
    response.once("close", close);

    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();

    const heartbeat = setInterval(() => {
      if (!response.destroyed) response.write(": keepalive\n\n");
    }, 15_000);

    this.logger.log(
      `POST /api/agent/runs/stream received inputChars=${runRequest.input.length}`,
    );
    try {
      for await (const event of this.agentService.stream(
        runRequest,
        abortController.signal,
      )) {
        if (response.destroyed) break;
        if (!response.write(formatSseEvent(event))) {
          await once(response, "drain");
        }
      }
    } finally {
      clearInterval(heartbeat);
      request.removeListener("aborted", abort);
      response.removeListener("close", close);
      if (!response.destroyed && !response.writableEnded) response.end();
    }
  }
}
