import { BadRequestException } from "@nestjs/common";
import { describe, expect, test } from "bun:test";
import { validateAuthCredentials } from "../src/auth/auth.validation";
import { AnalyzeService } from "../src/conversation/analyze.service";

describe("validateAuthCredentials", () => {
  test("rejects missing or empty email", () => {
    expect(() => validateAuthCredentials(undefined, "secret12")).toThrow(
      BadRequestException,
    );
    expect(() => validateAuthCredentials("", "secret12")).toThrow(
      BadRequestException,
    );
    expect(() => validateAuthCredentials("   ", "secret12")).toThrow(
      BadRequestException,
    );
  });

  test("rejects missing or short password", () => {
    expect(() => validateAuthCredentials("user@example.com", undefined)).toThrow(
      BadRequestException,
    );
    expect(() => validateAuthCredentials("user@example.com", "")).toThrow(
      BadRequestException,
    );
    expect(() => validateAuthCredentials("user@example.com", "12345")).toThrow(
      BadRequestException,
    );
  });

  test("accepts valid credentials", () => {
    expect(() =>
      validateAuthCredentials("user@example.com", "secret12"),
    ).not.toThrow();
  });
});

describe("AnalyzeService chat input validation", () => {
  test("rejects missing or empty input", async () => {
    const service = new AnalyzeService({} as never, {} as never, {} as never);

    await expect(service.analyze("user-1", "conv-1", "")).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.analyze("user-1", "conv-1", "   "),
    ).rejects.toThrow(BadRequestException);
  });
});
