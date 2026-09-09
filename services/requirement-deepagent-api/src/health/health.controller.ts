import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import type {
  LiveHealthResponse,
  ReadinessResponse,
} from "@autix/requirement-deepagent-contracts";
import {
  readModelRuntimeConfig,
  toPublicModelConfiguration,
} from "../model/model.config";

@Controller("api/health")
export class HealthController {
  @Get("live")
  live(): LiveHealthResponse {
    return {
      service: "requirement-deepagent-api",
      status: "alive",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  ready(@Res({ passthrough: true }) response: Response): ReadinessResponse {
    const configuration = toPublicModelConfiguration(readModelRuntimeConfig());
    const ready = configuration.apiKeyConfigured;
    response.status(ready ? 200 : 503);
    return {
      service: "requirement-deepagent-api",
      status: ready ? "ready" : "not_ready",
      checks: {
        modelConfiguration: {
          status: ready ? "pass" : "fail",
          message: ready
            ? `模型 ${configuration.model} 已配置，尚未执行实时连通性诊断。`
            : "缺少 OPENAI_API_KEY。",
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}
