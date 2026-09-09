import { Injectable, Logger } from "@nestjs/common";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import type { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import type {
  ModelDiagnosticFailureCode,
  ModelDiagnosticResponse,
} from "@autix/requirement-deepagent-contracts";
import { createDiagnosticModel } from "./model.factory";
import {
  readModelRuntimeConfig,
  toPublicModelConfiguration,
  type ModelRuntimeConfig,
} from "./model.config";

export const MODEL_PROBE_TOOL_NAME = "mvp0_capability_probe";

const capabilityProbe = tool(
  async ({ status }) => ({ accepted: status === "ok" }),
  {
    name: MODEL_PROBE_TOOL_NAME,
    description:
      "MVP-0 capability probe. Call this tool once with status set to ok.",
    schema: z.object({
      status: z.literal("ok"),
    }),
  },
);

export type ModelToolCallingProbe = (
  config: ModelRuntimeConfig,
) => Promise<void>;

class DiagnosticFailure extends Error {
  constructor(
    readonly code: ModelDiagnosticFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "DiagnosticFailure";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new DiagnosticFailure(
            "PROVIDER_TIMEOUT",
            `模型服务在 ${timeoutMs}ms 内没有返回，请检查网络或服务状态。`,
          ),
        ),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export const probeModelToolCalling: ModelToolCallingProbe = async (config) => {
  const model = createDiagnosticModel(config);
  // Let the model choose the tool from an unambiguous prompt. Some
  // OpenAI-compatible providers support tools but reject forced tool_choice.
  // DeepAgent also relies on ordinary model-selected tool calls, so this is the
  // more representative capability check.
  const runnable = model.bindTools([capabilityProbe]);
  const response = (await withTimeout(
    runnable.invoke([
      new SystemMessage(
        "You are running a capability check. Call the required probe tool exactly once.",
      ),
      new HumanMessage("Run the tool-calling capability probe now."),
    ]),
    config.timeoutMs,
  )) as AIMessage;
  const matched = response.tool_calls?.some(
    (call) => call.name === MODEL_PROBE_TOOL_NAME,
  );

  if (!matched) {
    throw new DiagnosticFailure(
      "TOOL_CALLING_UNSUPPORTED",
      "模型返回了响应，但没有按要求生成工具调用。请选择支持 tool calling 的模型。",
    );
  }
};

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.response?.status;
  return typeof status === "number" ? status : undefined;
}

export function classifyProviderError(error: unknown): {
  code: ModelDiagnosticFailureCode;
  message: string;
} {
  if (error instanceof DiagnosticFailure) {
    return { code: error.code, message: error.message };
  }

  const status = errorStatus(error);
  const normalized = errorText(error).toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    normalized.includes("api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("authentication")
  ) {
    return {
      code: "AUTHENTICATION_FAILED",
      message: "模型服务拒绝了凭据，请检查 OPENAI_API_KEY。",
    };
  }
  if (
    status === 404 ||
    normalized.includes("model not found") ||
    normalized.includes("does not exist")
  ) {
    return {
      code: "MODEL_NOT_FOUND",
      message: "模型或服务地址不存在，请检查 DEEPAGENT_MODEL 和 OPENAI_BASE_URL。",
    };
  }
  if (status === 400 || status === 422) {
    return {
      code: "PROVIDER_REJECTED_REQUEST",
      message:
        "模型服务拒绝了工具调用请求；请检查模型兼容性、模型名称和 provider 请求格式。",
    };
  }
  if (
    normalized.includes("tool") &&
    (normalized.includes("support") || normalized.includes("choice"))
  ) {
    return {
      code: "TOOL_CALLING_UNSUPPORTED",
      message: "当前模型或兼容服务不支持所需的 tool calling。",
    };
  }
  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("abort")
  ) {
    return {
      code: "PROVIDER_TIMEOUT",
      message: "模型服务响应超时，请检查网络、服务状态或超时配置。",
    };
  }
  if (
    status !== undefined ||
    normalized.includes("fetch") ||
    normalized.includes("connect") ||
    normalized.includes("network")
  ) {
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: "无法连接模型服务，请检查 OPENAI_BASE_URL 和网络状态。",
    };
  }
  return {
    code: "UNKNOWN_PROVIDER_ERROR",
    message: "模型诊断失败。请使用服务端 traceId 查看详细错误。",
  };
}

export async function runModelDiagnostic(
  config: ModelRuntimeConfig,
  probe: ModelToolCallingProbe = probeModelToolCalling,
  now: () => number = Date.now,
): Promise<ModelDiagnosticResponse> {
  const startedAt = now();
  const base = () => ({
    service: "requirement-deepagent-api" as const,
    configuration: toPublicModelConfiguration(config),
    latencyMs: Math.max(0, now() - startedAt),
    timestamp: new Date().toISOString(),
  });

  if (!config.apiKey) {
    return {
      ...base(),
      status: "failed",
      toolCalling: { supported: false },
      error: {
        code: "MODEL_NOT_CONFIGURED",
        message:
          "未配置 OPENAI_API_KEY。请在新服务的 .env 或仓库根 .env 中配置模型凭据。",
      },
    };
  }

  try {
    await probe(config);
    return {
      ...base(),
      status: "ready",
      toolCalling: {
        supported: true,
        probeToolName: MODEL_PROBE_TOOL_NAME,
      },
    };
  } catch (error) {
    return {
      ...base(),
      status: "failed",
      toolCalling: { supported: false },
      error: classifyProviderError(error),
    };
  }
}

@Injectable()
export class ModelDiagnosticsService {
  private readonly logger = new Logger(ModelDiagnosticsService.name);

  async diagnose(traceId: string): Promise<ModelDiagnosticResponse> {
    const config = readModelRuntimeConfig();
    const result = await runModelDiagnostic(config);
    if (result.status === "ready") {
      this.logger.log(
        `[trace:${traceId}] model diagnostic ready model=${result.configuration.model} latencyMs=${result.latencyMs}`,
      );
    } else {
      this.logger.warn(
        `[trace:${traceId}] model diagnostic failed code=${result.error.code} model=${result.configuration.model} latencyMs=${result.latencyMs}`,
      );
    }
    return result;
  }
}
