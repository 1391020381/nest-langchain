import { Injectable, Logger } from "@nestjs/common";
import { createChatModel } from "@autix/llm-core";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
  HumanMessage,
  AIMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { aiUIResponseSchema } from "./ui-schemas";
import type { AIUIResponse } from "./ui-types";
import { validateUIResponse } from "./ui-validate";

const UI_SYSTEM_PROMPT = `你是一名需求分析助手。你的回复必须是结构化 UI（message + components）。
组件选择：selection（明确选项）、form（多字段）、confirmation（重要确认）、card（详情）、steps/table/action_buttons/text。
组合规则：message 必填；components 可多个。
context.sessionStage 与 collectedData 要反映当前进度。
version 固定为 "1.0"。`;

export function buildFallbackUIResponse(reason: string): AIUIResponse {
  return validateUIResponse({
    version: "1.0",
    message: "暂时无法生成交互组件，请用文字继续描述。",
    components: [
      { type: "text", content: reason || "structured output failed" },
    ],
  });
}

@Injectable()
export class UIResponseService {
  private readonly logger = new Logger(UIResponseService.name);

  async generateUIResponse(
    input: string,
    history: BaseMessage[] = [],
    collectedData: Record<string, unknown> = {},
  ): Promise<AIUIResponse> {
    try {
      const model = createChatModel({ maxTokens: 2000 });
      const structured = model.withStructuredOutput(aiUIResponseSchema);
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", UI_SYSTEM_PROMPT],
        new MessagesPlaceholder("history"),
        ["human", "{input}"],
      ]);
      const enriched = `${input}\n\n[collectedData] ${JSON.stringify(collectedData)}`;
      const raw = (await prompt.pipe(structured).invoke({
        input: enriched,
        history,
      })) as AIUIResponse;
      return validateUIResponse({ ...raw, version: "1.0" });
    } catch (err) {
      this.logger.error(
        `structured generation failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      return buildFallbackUIResponse("structured output failed");
    }
  }

  toLangChainHistory(
    rows: Array<{ role: string; content: string }>,
  ): BaseMessage[] {
    return rows.map((row) =>
      row.role === "human"
        ? new HumanMessage(row.content)
        : new AIMessage(row.content),
    );
  }
}
