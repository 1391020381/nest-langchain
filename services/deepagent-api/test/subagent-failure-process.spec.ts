import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

describe("DeepAgent failure cleanup", () => {
  test("a rejected real subagent run does not terminate Bun with an unhandled rejection", () => {
    const serviceRoot = join(import.meta.dir, "..");
    const probe = join(
      import.meta.dir,
      "fixtures",
      "subagent-failure-probe.ts",
    );
    const result = spawnSync(process.execPath, [probe], {
      cwd: serviceRoot,
      encoding: "utf8",
      env: process.env,
      timeout: 30_000,
    });

    expect(result.error).toBeUndefined();
    expect(result.stdout).toContain("EXPECTED_STREAM_ERROR:");
    expect(result.stdout).toContain("EVENT_TYPES:progress");
    expect(result.stdout).toContain("PROBE_COMPLETED");
    expect(result.stderr).not.toContain("UnhandledPromiseRejection");
    expect(result.status).toBe(0);
  });
});
