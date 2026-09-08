import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "fs";
import { extname, join, relative } from "path";

const REPOSITORY_ROOT = join(import.meta.dir, "..", "..", "..");
const NEW_APP_ROOTS = [
  "services/deepagent-api",
  "clients/deepagent-web",
  "packages/deepagent-contracts",
];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const FORBIDDEN_REFERENCES = [
  "services/chat",
  "services/api",
  "clients/chat-web",
  "@autix/chat",
  "@autix/api",
  "@autix/chat-web",
  "../chat/",
  "../api/",
  "../chat-web/",
];

function importedSpecifiers(source: string): string[] {
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/gu,
    /\bimport\s*["']([^"']+)["']/gu,
    /\bimport\s*\(\s*["']([^"']+)["']/gu,
    /\brequire\s*\(\s*["']([^"']+)["']/gu,
  ];
  return patterns.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[1].replaceAll("\\", "/")),
  );
}

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "test"].includes(entry.name)) return [];
      return sourceFiles(path);
    }
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

describe("new application architecture boundary", () => {
  test("new source code never imports legacy applications", () => {
    const violations = NEW_APP_ROOTS.flatMap((root) =>
      sourceFiles(join(REPOSITORY_ROOT, root)).flatMap((file) => {
        const imports = importedSpecifiers(readFileSync(file, "utf8"));
        return imports.flatMap((specifier) =>
          FORBIDDEN_REFERENCES.filter((reference) =>
            specifier.includes(reference),
          ).map((reference) => ({
            file: relative(REPOSITORY_ROOT, file).replaceAll("\\", "/"),
            reference,
            specifier,
          })),
        );
      }),
    );

    expect(violations).toEqual([]);
  });

  test("new workspace manifests do not depend on legacy workspace packages", () => {
    const forbiddenPackages = new Set([
      "@autix/chat",
      "@autix/api",
      "@autix/chat-web",
    ]);
    const violations: Array<{ manifest: string; dependency: string }> = [];

    for (const root of NEW_APP_ROOTS) {
      const manifestPath = join(REPOSITORY_ROOT, root, "package.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
        string,
        Record<string, string> | undefined
      >;
      for (const section of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
      ]) {
        for (const dependency of Object.keys(manifest[section] ?? {})) {
          if (forbiddenPackages.has(dependency)) {
            violations.push({
              manifest: relative(REPOSITORY_ROOT, manifestPath).replaceAll(
                "\\",
                "/",
              ),
              dependency,
            });
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
