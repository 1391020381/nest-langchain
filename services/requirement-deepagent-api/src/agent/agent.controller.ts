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
  type AgentCancelRequest,
  type AgentCancelResponse,
  type AgentResumeRequest,
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

function validateResumeRequest(value: unknown): AgentResumeRequest {
  if (!value || typeof value !== "object") {
    throw new BadRequestException("请求体必须是 JSON 对象。");
  }
  const body = value as Record<string, unknown>;
  if (typeof body.threadId !== "string" || !body.threadId.trim()) {
    throw new BadRequestException("threadId 不能为空。");
  }
  if (typeof body.requestId !== "string" || !body.requestId.trim()) {
    throw new BadRequestException("requestId 不能为空。");
  }
  if (!Array.isArray(body.answers) || body.answers.length > 6) {
    throw new BadRequestException("answers 必须是最多包含 6 项的数组。");
  }
  const answers = body.answers.map((value) => {
    if (!value || typeof value !== "object") {
      throw new BadRequestException("answer 必须是对象。");
    }
    const answer = value as Record<string, unknown>;
    if (typeof answer.questionId !== "string" || !answer.questionId.trim()) {
      throw new BadRequestException("answer.questionId 不能为空。");
    }
    if (typeof answer.value !== "string" || answer.value.length > 2_000) {
      throw new BadRequestException("answer.value 必须是不超过 2,000 字的字符串。");
    }
    return {
      questionId: answer.questionId.trim(),
      value: answer.value.trim(),
    };
  });
  return {
    threadId: body.threadId.trim(),
    requestId: body.requestId.trim(),
    answers,
  };
}

function validateCancelRequest(value: unknown): AgentCancelRequest {
  if (!value || typeof value !== "object") {
    throw new BadRequestException("请求体必须是 JSON 对象。");
  }
  const threadId = (value as Record<string, unknown>).threadId;
  if (typeof threadId !== "string" || !threadId.trim()) {
    throw new BadRequestException("threadId 不能为空。");
  }
  return { threadId: threadId.trim() };
}

function validateRunId(value: string | string[] | undefined): string {
  const runId = Array.isArray(value) ? value[0] : value;
  if (!runId?.trim()) throw new BadRequestException("runId 不能为空。");
  return runId.trim();
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
    this.logger.log(
      `POST /api/agent/runs/stream received inputChars=${runRequest.input.length}`,
    );
    await this.pipeSse(
      request,
      response,
      (signal) => this.agentService.stream(runRequest, signal),
    );
  }

  @Post("runs/:runId/resume/stream")
  async resume(
    @Body() body: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const runId = validateRunId(request.params.runId);
    const resumeRequest = validateResumeRequest(body);
    this.agentService.validateResumeRequest(runId, resumeRequest);
    this.logger.log(
      `POST /api/agent/runs/${runId}/resume/stream received answers=${resumeRequest.answers.length}`,
    );
    await this.pipeSse(
      request,
      response,
      (signal) => this.agentService.resume(runId, resumeRequest, signal),
    );
  }

  @Post("runs/:runId/cancel")
  cancel(
    @Body() body: unknown,
    @Req() request: Request,
  ): AgentCancelResponse {
    const runId = validateRunId(request.params.runId);
    return this.agentService.cancel(runId, validateCancelRequest(body));
  }

  private async pipeSse(
    request: Request,
    response: Response,
    createStream: (signal: AbortSignal) => AsyncGenerator<AgentStreamEvent>,
  ): Promise<void> {
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

    try {
      for await (const event of createStream(abortController.signal)) {
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
