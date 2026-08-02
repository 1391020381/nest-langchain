import { describe, expect, test } from "bun:test";
import { BadRequestException } from "@nestjs/common";
import { LlmController } from "../src/llm/llm.controller";
import { LlmService } from "../src/llm/llm.service";

const SAMPLE = "用户注册时必须绑定手机号，密码至少8位";

describe("LlmController", () => {
  test("prompt-preview rejects empty input", async () => {
    const controller = new LlmController(new LlmService());
    await expect(controller.promptPreview({ input: "  " })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  test("batch rejects empty inputs", async () => {
    const controller = new LlmController(new LlmService());
    await expect(controller.batch({ inputs: [] })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  test("prompt-preview renders without calling the model", async () => {
    const controller = new LlmController(new LlmService());
    const { rendered } = await controller.promptPreview({ input: SAMPLE });
    expect(rendered).toContain(SAMPLE);
  });
});
