import { afterEach, describe, expect, it } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAllowedModelEnvironment } from "../src/bootstrap/load-model-env";

const touchedKeys = [
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
  "DEEPAGENT_MODEL",
  "PORT",
  "DATABASE_URL",
] as const;
const originalValues = Object.fromEntries(
  touchedKeys.map((key) => [key, process.env[key]]),
);
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const key of touchedKeys) {
    const original = originalValues[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("model environment isolation", () => {
  it("loads local config and only allowlisted values from existing env files", () => {
    for (const key of touchedKeys) delete process.env[key];

    const root = mkdtempSync(join(tmpdir(), "requirement-deepagent-env-"));
    temporaryRoots.push(root);
    const serviceRoot = join(root, "services", "requirement-deepagent-api");
    const existingServiceRoot = join(root, "services", "chat");
    mkdirSync(serviceRoot, { recursive: true });
    mkdirSync(existingServiceRoot, { recursive: true });

    writeFileSync(
      join(root, ".env"),
      "OPENAI_API_KEY=root-key\nDATABASE_URL=must-not-load\n",
    );
    writeFileSync(
      join(existingServiceRoot, ".env"),
      "OPENAI_MODEL=tool-model\nDATABASE_URL=also-must-not-load\n",
    );
    writeFileSync(join(serviceRoot, ".env"), "PORT=4300\n");

    loadAllowedModelEnvironment(serviceRoot);

    expect(process.env.PORT).toBe("4300");
    expect(process.env.OPENAI_API_KEY).toBe("root-key");
    expect(process.env.OPENAI_MODEL).toBe("tool-model");
    expect(process.env.DATABASE_URL).toBeUndefined();
  });
});
