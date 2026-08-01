import { describe, expect, test } from "bun:test";
import { BadRequestException } from "@nestjs/common";
import { RequirementService } from "../src/llm/requirement.service";

const SAMPLE = "用户注册时必须绑定手机号，密码至少8位";
const hasKey = Boolean(process.env.OPENAI_API_KEY);

describe("RequirementService", () => {
  test("rejects empty input", async () => {
    const service = new RequirementService();
    await expect(service.extract("")).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  test.skipIf(!hasKey)("extracts structured fields from sample", async () => {
    const service = new RequirementService();
    const result = await service.extract(SAMPLE);
    expect(result.action).toContain("注册");
    expect(result.constraints.some((c) => c.includes("手机号"))).toBe(true);
    expect(result.entities).toContain("手机号");
  });
});
