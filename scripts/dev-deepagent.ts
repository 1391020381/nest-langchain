import { spawn } from "node:child_process";
import { join } from "node:path";

type Target = "api" | "web";

const repositoryRoot = join(__dirname, "..");
const requestedTarget = process.argv[2];

if (
  requestedTarget !== undefined &&
  requestedTarget !== "api" &&
  requestedTarget !== "web"
) {
  console.error("用法：bun scripts/dev-deepagent.ts [api|web]");
  process.exit(1);
}

const targets: Array<{
  name: Target;
  cwd: string;
  command: string[];
}> = [
  {
    name: "api",
    cwd: join(repositoryRoot, "services", "deepagent-api"),
    command: [process.execPath, "--watch", "src/main.ts"],
  },
  {
    name: "web",
    cwd: join(repositoryRoot, "clients", "deepagent-web"),
    command: [
      process.execPath,
      "node_modules/next/dist/bin/next",
      "dev",
      "--port",
      "3100",
    ],
  },
];

const selectedTargets = requestedTarget
  ? targets.filter(({ name }) => name === requestedTarget)
  : targets;

const children = selectedTargets.map((target) => ({
  name: target.name,
  process: spawn(target.command[0]!, target.command.slice(1), {
    cwd: target.cwd,
    // Codex/IDE hosts may inject a generic PORT for their own process. Do not
    // let it override services/deepagent-api/.env; the API owns its port.
    env:
      target.name === "api"
        ? Object.fromEntries(
            Object.entries(process.env).filter(([name]) => name !== "PORT"),
          )
        : process.env,
    stdio: "inherit",
  }),
}));

let shuttingDown = false;
let requestedExitCode = 0;

function allChildrenExited(): boolean {
  return children.every(
    (child) =>
      child.process.exitCode !== null || child.process.signalCode !== null
  );
}

function shutdown(exitCode: number): void {
  if (shuttingDown) return;
  shuttingDown = true;
  requestedExitCode = exitCode;

  for (const child of children) {
    if (child.process.exitCode === null && child.process.signalCode === null) {
      child.process.kill();
    }
  }

  const forceExit = setTimeout(() => process.exit(requestedExitCode), 2_000);
  forceExit.unref();
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

for (const child of children) {
  child.process.on("exit", (exitCode, signal) => {
    if (shuttingDown) {
      if (allChildrenExited()) process.exit(requestedExitCode);
      return;
    }

    const reason = exitCode === null ? signal : `exit ${exitCode}`;
    console.error(`${child.name} 开发服务已退出（${reason}）`);
    shutdown(exitCode || 1);
  });
}
