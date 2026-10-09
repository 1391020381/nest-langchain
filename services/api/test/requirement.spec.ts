import { describe, expect, test } from "bun:test";
import {
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import type { BaseMessage } from "@langchain/core/messages";
import { RequirementService } from "../src/llm/requirement.service";

const SAMPLE = "用户注册时必须绑定手机号，密码至少8位";
const runLiveTests = process.env.RUN_LIVE_LLM_TESTS === "1";

class StubRequirementService extends RequirementService {
  receivedMessages: BaseMessage[] = [];

  constructor(
    private readonly result: unknown,
    private readonly failure?: Error
  ) {
    super();
  }

  protected override async invokeStructuredModel(
    messages: BaseMessage[]
  ): Promise<unknown> {
    this.receivedMessages = messages;
    if (this.failure) throw this.failure;
    return this.result;
  }
}

describe("RequirementService", () => {
  test("rejects empty input", async () => {
    const service = new RequirementService();
    await expect(service.extract("")).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  test("returns only schema-validated structured output", async () => {
    const expected = {
      action: "注册用户",
      constraints: ["必须绑定手机号", "密码至少8位"],
      entities: ["用户", "手机号", "密码"],
    };
    const service = new StubRequirementService(expected);

    await expect(service.extract(`  ${SAMPLE}  `)).resolves.toEqual(expected);
    expect(service.receivedMessages).toHaveLength(2);
    expect(service.receivedMessages[1]?.content.toString()).toContain(SAMPLE);
  });

  test("rejects malformed model output", async () => {
    const service = new StubRequirementService({ action: "注册用户" });
    await expect(service.extract(SAMPLE)).rejects.toBeInstanceOf(
      InternalServerErrorException
    );
  });

  test("maps provider errors without exposing provider details", async () => {
    const service = new StubRequirementService(
      null,
      new Error("secret-provider-detail")
    );

    try {
      await service.extract(SAMPLE);
      throw new Error("expected extract to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect((error as Error).message).not.toContain("secret-provider-detail");
    }
  });

  test.skipIf(!runLiveTests)("extracts structured fields from sample", async () => {
    const service = new RequirementService();
    const result = await service.extract(SAMPLE);
    expect(result.action).toContain("注册");
    expect(result.constraints.some((c) => c.includes("手机号"))).toBe(true);
    expect(result.entities).toContain("手机号");
  }, 30_000);
});
