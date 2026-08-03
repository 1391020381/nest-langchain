import { describe, expect, test } from "bun:test";
import * as bcrypt from "bcrypt";

describe("password hashing contract", () => {
  test("bcrypt cost 10 roundtrip", async () => {
    const hash = await bcrypt.hash("secret123", 10);
    expect(await bcrypt.compare("secret123", hash)).toBe(true);
    expect(await bcrypt.compare("wrong", hash)).toBe(false);
  });
});
