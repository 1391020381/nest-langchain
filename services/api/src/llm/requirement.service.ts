import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RequirementResultSchema,
  type RequirementResult,
} from "@autix/contracts";
import { createChatModel } from "./model.factory";
import {
  REQUIREMENT_SYSTEM_PROMPT,
  REQUIREMENT_USER_TEMPLATE,
} from "./prompts/requirement.prompt";

@Injectable()
export class RequirementService {
  private model = createChatModel();

  private prompt = ChatPromptTemplate.fromMessages([
    ["system", REQUIREMENT_SYSTEM_PROMPT],
    ["human", REQUIREMENT_USER_TEMPLATE],
  ]);

  async extract(input: string): Promise<RequirementResult> {
    if (!input?.trim()) {
      throw new BadRequestException("input is required");
    }

    const messages = await this.prompt.formatMessages({ input });
    // SiliconFlow OpenAI-compatible: functionCalling is reliable;
    // jsonMode often hangs on some models.
    const structuredModel = this.model.withStructuredOutput(
      RequirementResultSchema,
      { method: "functionCalling" }
    );

    try {
      return await structuredModel.invoke(messages);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "structured extract failed";
      throw new InternalServerErrorException(
        `Requirement extract failed: ${message}`
      );
    }
  }
}
