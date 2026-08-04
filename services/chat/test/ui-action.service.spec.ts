import { describe, expect, mock, test } from "bun:test";
import { isConfirmAnalyze } from "../src/llm/ui-protocol/ui-persistence";
import { UIChatService } from "../src/llm/ui-protocol/ui-chat.service";
import type { UIAction } from "../src/llm/ui-protocol/ui-types";

describe("confirm action contract", () => {
  test("isConfirmAnalyze is true only for confirmed=true", () => {
    const action: UIAction = {
      componentType: "confirmation",
      payload: { type: "confirm", confirmed: true },
    };
    expect(isConfirmAnalyze(action)).toBe(true);
  });

  // confirm=true → streamSuggested; must not call generateUIResponse / orchestrate
  test("action confirm=true returns streamSuggested and does not call generateUIResponse", async () => {
    const generateUIResponse = mock(async () => {
      throw new Error("should not be called");
    });
    const analyze = mock(async () => {
      throw new Error("no orchestrate");
    });

    const conversations = {
      getOwnedOrThrow: mock(async () => ({ id: "c1", userId: "u1" })),
    };
    const prisma = {
      message: {
        findMany: mock(async () => []),
        create: mock(async () => ({})),
      },
    };

    const service = new UIChatService(
      conversations as any,
      prisma as any,
      { generateUIResponse, toLangChainHistory: () => [] } as any,
      { analyze } as any,
    );

    const result = await service.action("u1", "c1", {
      componentType: "confirmation",
      payload: { type: "confirm", confirmed: true },
    });

    expect(result.streamSuggested).toBe(true);
    expect(result.context?.sessionStage).toBe("analyzing");
    expect(generateUIResponse).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
  });
});
