import { describe, expect, test } from "bun:test";
import { ConflictException } from "@nestjs/common";
import { assertProcessable } from "../src/document/document.service";

describe("process guard", () => {
  test("allows pending documents", () => {
    expect(() => assertProcessable("pending")).not.toThrow();
  });

  test.each(["processing", "completed"])(
    "rejects %s documents with 409",
    (status) => {
      try {
        assertProcessable(status);
        throw new Error("Expected assertProcessable to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).getStatus()).toBe(409);
      }
    },
  );
});
