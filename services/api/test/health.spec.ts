import { describe, expect, test } from "bun:test";
import { AppService } from "../src/app.service";

describe("AppService health", () => {
  test("returns ok true", () => {
    const service = new AppService();
    expect(service.getHealth()).toEqual({ ok: true });
  });
});
