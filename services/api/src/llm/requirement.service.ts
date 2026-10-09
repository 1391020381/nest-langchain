import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RequirementSchema,
  RequirementResultSchema,
  type RequirementResult,
} from "@autix/contracts";
import type { BaseMessage } from "@langchain/core/messages";
import { createChatModel } from "./model.factory";
import {
  REQUIREMENT_SYSTEM_PROMPT,
  REQUIREMENT_USER_TEMPLATE,
} from "./prompts/requirement.prompt";

@Injectable()
export class RequirementService {
  private prompt = ChatPromptTemplate.fromMessages([
    ["system", REQUIREMENT_SYSTEM_PROMPT],
    ["human", REQUIREMENT_USER_TEMPLATE],
  ]);

  protected async invokeStructuredModel(
    messages: BaseMessage[]
  ): Promise<unknown> {
    // SiliconFlow OpenAI-compatible: functionCalling is reliable;
    // jsonMode often hangs on some models.
    const structuredModel = createChatModel().withStructuredOutput(
      RequirementResultSchema,
      { method: "functionCalling" }
    );
    return structuredModel.invoke(messages);
  }

  async extract(input: unknown): Promise<RequirementResult> {
    const parsedInput = RequirementSchema.safeParse({ input });
    if (!parsedInput.success) {
      throw new BadRequestException("input must be a non-empty string");
    }

    const messages = await this.prompt.formatMessages({
      input: parsedInput.data.input,
    });

    let rawResult: unknown;

    try {
      rawResult = await this.invokeStructuredModel(messages);
    } catch (error) {
      const errorType = error instanceof Error ? error.name : typeof error;
      console.error("[RequirementService] model invocation failed", {
        errorType,
      });
      throw new InternalServerErrorException(
        "Requirement model invocation failed"
      );
    }

    const parsedResult = RequirementResultSchema.safeParse(rawResult);
    if (!parsedResult.success) {
      console.error("[RequirementService] invalid structured output", {
        issues: parsedResult.error.issues,
      });
      throw new InternalServerErrorException(
        "Requirement model returned invalid structured output"
      );
    }

    return parsedResult.data;
  }
}
