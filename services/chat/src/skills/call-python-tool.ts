import { execSync } from "child_process";
import { join } from "path";

export const SKILLS_DIR = join(import.meta.dir, "definitions");

function pythonExecutable(): string {
  for (const cmd of ["python3", "python"]) {
    try {
      execSync(`${cmd} --version`, { stdio: "ignore" });
      return cmd;
    } catch {
      // try next
    }
  }
  throw new Error("未找到 python3 或 python，第十四章 Layer 1 需要本机 Python");
}

export function callPythonTool(
  skillName: string,
  scriptName: string,
  input: Record<string, unknown>,
): string {
  const scriptPath = join(SKILLS_DIR, skillName, "scripts", scriptName);
  return execSync(`${pythonExecutable()} "${scriptPath}"`, {
    input: JSON.stringify(input),
    encoding: "utf-8",
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
    },
  }).trim();
}
