import { describe, expect, it } from "bun:test";
import { AIMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import { createRequirementDeepAgent } from "../src/agent/agent.factory";
import { DeepAgentRuntime } from "../src/agent/runtime/deepagent.runtime";

const report = `# 需求分析报告

## 需求摘要
支持批量导入。

## 完整性分析
边界清晰。

## 复杂度评估
中等。

## 风险清单
需要限制文件大小。

## 用户故事
作为管理员，我希望导入成员，以便提高效率。

## 验收标准
假如文件有效，当管理员导入，那么系统完成处理。`;

function toolCall(name: string, args: Record<string, unknown>, id: string) {
  return new AIMessage({
    content: "",
    tool_calls: [{ name, args, id, type: "tool_call" }],
  });
}

class ScriptedToolModel extends BaseChatModel {
  private index = 0;

  constructor(private readonly responses: AIMessage[]) {
    super({});
  }

  _llmType(): string {
    return "scripted-tool-model";
  }

  bindTools(): this {
    return this;
  }

  async _generate(_messages: BaseMessage[]): Promise<ChatResult> {
    const message = this.responses[this.index++];
    if (!message) throw new Error("scripted model ran out of responses");
    return {
      generations: [{
        message,
        text: typeof message.content === "string" ? message.content : "",
      }],
    };
  }
}

describe("DeepAgent runtime with a scripted model", () => {
  it("uses todos, delegates to requirement-analyst and exports /work", async () => {
    const pendingTodos = [
      { content: "委派需求专家", status: "in_progress" },
      { content: "整理报告", status: "pending" },
      { content: "确认交付", status: "pending" },
    ];
    const finalTodos = pendingTodos.map((todo) => ({
      ...todo,
      status: "completed",
    }));
    const model = new ScriptedToolModel([
      toolCall("write_todos", { todos: pendingTodos }, "call-todos-1"),
      toolCall(
        "task",
        {
          description: "分析用户提交的批量导入需求",
          subagent_type: "requirement-analyst",
        },
        "call-task",
      ),
      new AIMessage(report),
      toolCall(
        "write_todos",
        {
          todos: [
            { content: "委派需求专家", status: "completed" },
            { content: "整理报告", status: "in_progress" },
            { content: "确认交付", status: "pending" },
          ],
        },
        "call-todos-2",
      ),
      toolCall(
        "write_file",
        { file_path: "/work/final-report.md", content: report },
        "call-write",
      ),
      toolCall("write_todos", { todos: finalTodos }, "call-todos-3"),
      new AIMessage(report),
    ]);
    const runtime = new DeepAgentRuntime(createRequirementDeepAgent(model));
    const events = [];
    for await (const event of runtime.stream("批量导入需求", {
      runId: "run-scripted",
      threadId: "thread-scripted",
      signal: new AbortController().signal,
      recursionLimit: 30,
    })) {
      events.push(event);
    }

    expect(
      events.some(
        (event) =>
          event.type === "agent.progress" &&
          event.agent === "requirement-analyst" &&
          event.status === "started",
      ),
    ).toBe(true);
    expect(
      events.filter(
        (event) => event.type === "tool.progress" && event.tool === "task",
      ),
    ).toHaveLength(2);
    const completed = events.find((event) => event.type === "report.completed");
    expect(completed).toMatchObject({
      type: "report.completed",
      report,
      artifacts: [{ path: "/work/final-report.md", virtual: true }],
    });
  }, 30_000);
});
