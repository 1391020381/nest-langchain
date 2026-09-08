import { join } from "node:path";

type Target = "api" | "web";

const repositoryRoot = join(import.meta.dir, "..");
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
  process: Bun.spawn({
    cmd: target.command,
    cwd: target.cwd,
    // Codex/IDE hosts may inject a generic PORT for their own process. Do not
    // let it override services/deepagent-api/.env; the API owns its port.
    env:
      target.name === "api"
        ? Object.fromEntries(
            Object.entries(process.env).filter(([name]) => name !== "PORT"),
          )
        : process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }),
}));

let shuttingDown = false;

async function shutdown(exitCode: number): Promise<never> {
  if (!shuttingDown) {
    shuttingDown = true;
    for (const child of children) {
      if (child.process.exitCode === null) child.process.kill();
    }
    await Promise.all(children.map((child) => child.process.exited));
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => void shutdown(130));
process.on("SIGTERM", () => void shutdown(143));

for (const child of children) {
  void child.process.exited.then((exitCode) => {
    if (shuttingDown) return;
    console.error(`${child.name} 开发服务已退出（exit ${exitCode}）`);
    void shutdown(exitCode || 1);
  });
}

await new Promise(() => undefined);
