import { z } from "zod";
const schema = z.object({
  todos: z.array(z.object({ content: z.string(), status: z.enum(["pending", "in_progress", "completed"]) })).default([]),
  files: z.record(z.unknown()).default({}),
});

/** 模型可能只回复摘要；从 StateBackend 提取完整报告用于终端展示。 */
export function readReport(files: Record<string, unknown>): string | undefined {
  // FileData v1 是行数组，v2（当前默认）是完整字符串。
  const file = z.object({ content: z.union([z.string(), z.array(z.string())]) })
    .safeParse(files["/research/report.md"]);
  if (!file.success) return undefined;
  const content = file.data.content;
  return (typeof content === "string" ? content : content.join("\n")).trim() || undefined;
}
/** 只展示执行后的 state，不把模型提出的调用当作已完成的更新。 */
export function createProgressReporter(log: (text: string) => void = console.log) {
  let previousTodos = "[]";
  let previousFiles = "[]";
  return (state: unknown) => {
    const { todos, files } = schema.parse(state);
    const nextTodos = JSON.stringify(todos);
    if (nextTodos !== previousTodos) {
      log("\n[任务计划]\n" + todos.map((todo, i) => `${i + 1}. [${todo.status}] ${todo.content}`).join("\n"));
      previousTodos = nextTodos;
    }
    const names = Object.keys(files).sort();
    if (JSON.stringify(names) !== previousFiles) {
      log(`[虚拟文件] ${names.join(", ")}`);
      previousFiles = JSON.stringify(names);
    }
    return { todos, files };
  };
}
