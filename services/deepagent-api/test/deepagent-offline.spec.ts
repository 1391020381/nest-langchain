import { describe, expect, test } from "bun:test";
import { AIMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  ConfigurationError,
  createDeepAgent,
  getHarnessProfile,
  type FileData,
} from "deepagents";
import { z } from "zod";
import { createRequirementAgent } from "../src/agent/agent.factory";
import { streamRequirementWithModel } from "../src/agent/deepagent.runtime";
import { loadRequirementSkillFiles } from "../src/agent/skill-files";
import {
  createRequirementSubagents,
  REQUIREMENT_SUBAGENT_ARTIFACTS,
  REQUIREMENT_SUBAGENT_NAMES,
} from "../src/agent/subagents/requirement.subagents";
import { createRequirementTools } from "../src/agent/tools/requirement.tools";
import type { RuntimeEvent } from "../src/agent/types";

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (block && typeof block === "object" && "text" in block) {
        const text = (block as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function skillFile(): FileData {
  const timestamp = "2026-09-07T00:00:00.000Z";
  return {
    content: `---
name: requirement-analysis
description: Analyze software requirements and define acceptance criteria.
allowed-tools: read_file analyze_completeness estimate_complexity
---
# Requirement Analysis

Always distinguish facts from assumptions.`,
    mimeType: "text/markdown",
    created_at: timestamp,
    modified_at: timestamp,
  };
}

describe("DeepAgent 1.10.2 offline harness", () => {
  test("the application runtime maps the complete v2 multi-agent workflow into domain events", async () => {
    const model = fakeModel()
      .respondWithTools([
        {
          name: "write_todos",
          args: {
            todos: [
              { content: "完成三位专家分析并生成报告", status: "in_progress" },
            ],
          },
          id: "runtime-todo-start",
        },
      ])
      .respondWithTools([
        {
          name: "task",
          args: {
            subagent_type: "requirement-analyst",
            description: "分析完整性、范围和复杂度",
          },
          id: "runtime-requirement-task",
        },
      ])
      .respond(new AIMessage("需求专家已完成分析。"))
      .respondWithTools([
        {
          name: "write_file",
          args: {
            file_path: "/work/requirement-analysis.md",
            content: "# 需求分析\n\n完整性与复杂度分析已完成。",
          },
          id: "runtime-write-requirement",
        },
      ])
      .respondWithTools([
        {
          name: "task",
          args: {
            subagent_type: "risk-reviewer",
            description: "审查技术、数据、安全和交付风险",
          },
          id: "runtime-risk-task",
        },
      ])
      .respond(new AIMessage("风险专家已完成审查。"))
      .respondWithTools([
        {
          name: "write_file",
          args: {
            file_path: "/work/risk-review.md",
            content: "# 风险审查\n\n已记录风险等级、触发条件和缓解措施。",
          },
          id: "runtime-write-risk",
        },
      ])
      .respondWithTools([
        {
          name: "task",
          args: {
            subagent_type: "acceptance-designer",
            description: "设计 Given-When-Then 验收标准",
          },
          id: "runtime-acceptance-task",
        },
      ])
      .respond(new AIMessage("验收专家已完成设计。"))
      .respondWithTools([
        {
          name: "write_file",
          args: {
            file_path: "/work/acceptance-criteria.md",
            content: "# 验收标准\n\nGiven 输入有效，When 执行，Then 返回成功。",
          },
          id: "runtime-write-acceptance",
        },
      ])
      // DeepAgents counts the full coordinator prompt and tool schemas. Once
      // the history crosses its threshold it uses the same model to create a
      // summary before asking the coordinator for its next action.
      .respond(new AIMessage("离线摘要：三位专家已完成各自的独立分析。"))
      .respondWithTools([
        {
          name: "read_file",
          args: {
            file_path: "/work/requirement-analysis.md",
            offset: 0,
            limit: 1_000,
          },
          id: "runtime-read-requirement",
        },
        {
          name: "read_file",
          args: {
            file_path: "/work/risk-review.md",
            offset: 0,
            limit: 1_000,
          },
          id: "runtime-read-risk",
        },
        {
          name: "read_file",
          args: {
            file_path: "/work/acceptance-criteria.md",
            offset: 0,
            limit: 1_000,
          },
          id: "runtime-read-acceptance",
        },
      ])
      .respond(new AIMessage("离线摘要：三份专家产物已经读取。"))
      .respondWithTools([
        {
          name: "write_file",
          args: {
            file_path: "/work/final-report.md",
            content: "# Runtime 最终报告\n\n三位专家产物已汇总，v2 事件适配已验证。",
          },
          id: "runtime-write-final",
        },
      ])
      .respond(new AIMessage("离线摘要：最终报告已经写入虚拟文件系统。"))
      .respondWithTools([
        {
          name: "write_todos",
          args: {
            todos: [
              { content: "完成三位专家分析并生成报告", status: "completed" },
            ],
          },
          id: "runtime-todo-finish",
        },
      ])
      .respond(new AIMessage("离线摘要：唯一计划项已经标记完成。"))
      .respond(
        new AIMessage(
          "# Runtime 最终报告\n\n三位专家产物已汇总，v2 事件适配已验证。",
        ),
      );
    const events: RuntimeEvent[] = [];

    for await (const event of streamRequirementWithModel(
      model,
      "分析一个离线需求",
      { runId: "runtime-test", threadId: "runtime-thread" },
    )) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: "progress",
      agent: "coordinator",
      status: "started",
    });
    expect(
      events.filter(
        (event) => event.type === "progress" && event.status === "failed",
      ),
    ).toEqual([]);

    for (const agent of [
      "requirement-analyst",
      "risk-reviewer",
      "acceptance-designer",
    ]) {
      const lifecycle = events
        .filter(
          (event) =>
            event.type === "progress" &&
            event.agent === agent &&
            event.tool === undefined,
        )
        .map((event) => (event.type === "progress" ? event.status : undefined));
      expect(lifecycle).toEqual(["started", "completed"]);
    }

    const artifactEvents = events.filter(
      (event): event is Extract<RuntimeEvent, { type: "artifact" }> =>
        event.type === "artifact",
    );
    expect(artifactEvents.map((event) => event.path)).toEqual([
      "/work/acceptance-criteria.md",
      "/work/final-report.md",
      "/work/requirement-analysis.md",
      "/work/risk-review.md",
    ]);
    const final = events.at(-1);
    expect(final).toMatchObject({
      type: "final",
      report:
        "# Runtime 最终报告\n\n三位专家产物已汇总，v2 事件适配已验证。",
      todos: [
        { content: "完成三位专家分析并生成报告", status: "completed" },
      ],
      usedAgents: [
        "requirement-analyst",
        "risk-reviewer",
        "acceptance-designer",
      ],
    });
    if (final?.type === "final") {
      expect(Object.keys(final.artifacts).sort()).toEqual([
        "/work/acceptance-criteria.md",
        "/work/final-report.md",
        "/work/requirement-analysis.md",
        "/work/risk-review.md",
      ]);
      expect(final.toolCalls.filter((name) => name === "task")).toHaveLength(3);
      expect(final.toolCalls.filter((name) => name === "read_file")).toHaveLength(
        3,
      );
      expect(final.toolCalls).toContain("write_todos");
      expect(final.toolCalls).toContain("write_file");
    }
  });

  test("a direct model answer without required artifacts is rejected", async () => {
    const model = fakeModel().respond(
      new AIMessage("直接回答，但没有执行专家委派或生成工作产物。"),
    );
    const events: RuntimeEvent[] = [];
    let failure: unknown;

    try {
      for await (const event of streamRequirementWithModel(
        model,
        "分析一个离线需求",
        { runId: "incomplete-test", threadId: "incomplete-thread" },
      )) {
        events.push(event);
      }
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("DeepAgent 未生成必需产物");
    expect(events.some((event) => event.type === "final")).toBe(false);
    expect(events.at(-1)).toEqual({
      type: "progress",
      agent: "coordinator",
      status: "failed",
      message: "产物校验失败",
    });
  });

  test("the OpenAI harness keeps its general-purpose subagent disabled", () => {
    expect(getHarnessProfile("openai")?.generalPurposeSubagent?.enabled).toBe(
      false,
    );
  });

  test("fake models drive planning, delegation, VFS writes, and v3 projections", async () => {
    const coordinator = fakeModel()
      .respondWithTools([
        {
          name: "write_todos",
          args: {
            todos: [{ content: "分析需求", status: "in_progress" }],
          },
          id: "todo-start",
        },
      ])
      .respondWithTools([
        {
          name: "task",
          args: {
            subagent_type: "requirement-analyst",
            description: "分析需求完整性",
          },
          id: "delegate-analysis",
        },
      ])
      .respondWithTools([
        {
          name: "write_file",
          args: {
            file_path: "/work/final-report.md",
            content: "# 离线最终报告\n\n可以进入评审。",
          },
          id: "write-final",
        },
      ])
      .respondWithTools([
        {
          name: "write_todos",
          args: {
            todos: [{ content: "分析需求", status: "completed" }],
          },
          id: "todo-finish",
        },
      ])
      .respond(new AIMessage("# 离线最终报告\n\n可以进入评审。"));

    const analyst = fakeModel()
      .respondWithTools([
        {
          name: "write_file",
          args: {
            file_path: "/work/requirement-analysis.md",
            content: "# 专家分析\n\n缺少失败重试规则。",
          },
          id: "write-analysis",
        },
      ])
      .respond(new AIMessage("专家分析已完成"));

    const agent = createDeepAgent({
      name: "offline-coordinator",
      model: coordinator,
      skills: ["/skills/"],
      subagents: [
        {
          name: "requirement-analyst",
          description: "分析需求完整性",
          systemPrompt: "读取需求分析 Skill，给出独立结论。",
          model: analyst,
          skills: ["/skills/"],
        },
      ],
    });
    const run = await agent.streamEvents(
      {
        messages: [{ role: "user", content: "分析批量导入需求" }],
        files: {
          "/skills/requirement-analysis/SKILL.md": skillFile(),
        },
      },
      { version: "v3", recursionLimit: 40 },
    );

    const rootTools: Array<{
      name: string;
      status: string;
      error: string | undefined;
    }> = [];
    const subagents: string[] = [];
    const subagentTools: string[] = [];

    const drainTools = (async () => {
      for await (const call of run.toolCalls) {
        rootTools.push({
          name: call.name,
          status: await call.status,
          error: await call.error,
        });
      }
    })();
    const drainSubagents = (async () => {
      for await (const subagent of run.subagents) {
        subagents.push(subagent.name);
        const drainNestedTools = (async () => {
          for await (const call of subagent.toolCalls) {
            subagentTools.push(call.name);
            expect(await call.status).toBe("finished");
          }
        })();
        const subagentOutput = await subagent.output;
        await drainNestedTools;
        expect(textOf(subagentOutput.messages.at(-1)?.content)).toContain(
          "专家分析已完成",
        );
      }
    })();

    const output = await run.output;
    await Promise.all([drainTools, drainSubagents]);

    expect(rootTools).toEqual([
      { name: "write_todos", status: "finished", error: undefined },
      { name: "task", status: "finished", error: undefined },
      { name: "write_file", status: "finished", error: undefined },
      { name: "write_todos", status: "finished", error: undefined },
    ]);
    expect(subagents).toEqual(["requirement-analyst"]);
    expect(subagentTools).toEqual(["write_file"]);
    expect(output.todos).toEqual([
      { content: "分析需求", status: "completed" },
    ]);
    expect(output.files["/work/requirement-analysis.md"].content).toContain(
      "专家分析",
    );
    expect(output.files["/work/final-report.md"].content).toContain(
      "离线最终报告",
    );
    expect(textOf(output.messages.at(-1)?.content)).toContain("离线最终报告");

    const coordinatorPrompt = JSON.stringify(
      coordinator.calls[0]?.messages[0]?.content,
    );
    const analystPrompt = JSON.stringify(analyst.calls[0]?.messages[0]?.content);
    expect(coordinatorPrompt).toContain("requirement-analysis");
    expect(analystPrompt).toContain("requirement-analysis");
  });

  test("the application factory exposes its packaged skill through StateBackend", async () => {
    const model = fakeModel()
      .respondWithTools([
        {
          name: "read_file",
          args: {
            file_path:
              "/skills/requirement-analysis/references/scoring-rubric.md",
            offset: 0,
            limit: 1000,
          },
          id: "read-skill",
        },
      ])
      .respond(new AIMessage("Skill 已读取"));
    const agent = createRequirementAgent(model);
    const files = await loadRequirementSkillFiles();
    const output = await agent.invoke({
      messages: [{ role: "user", content: "使用需求分析 Skill" }],
      files,
    });
    const readResult = output.messages.find(
      (message) => message.getType() === "tool",
    );

    expect(JSON.stringify(model.calls[0]?.messages[0]?.content)).toContain(
      "requirement-analysis",
    );
    expect(textOf(readResult?.content)).toContain("验收标准");
  });

  test("the application factory allows read-only discovery of the VFS root", async () => {
    const model = fakeModel()
      .respondWithTools([
        {
          name: "ls",
          args: { path: "/" },
          id: "list-vfs-root",
        },
      ])
      .respond(new AIMessage("虚拟目录发现完成"));
    const agent = createRequirementAgent(model);
    const files = await loadRequirementSkillFiles();
    const output = await agent.invoke({
      messages: [{ role: "user", content: "查看可用的虚拟目录" }],
      files,
    });
    const listResult = output.messages.find(
      (message) => message.getType() === "tool",
    );

    expect(textOf(listResult?.content)).toContain("/skills");
  });

  test("each requirement subagent has one explicit writable artifact", () => {
    const subagents = createRequirementSubagents(
      fakeModel(),
      createRequirementTools(),
    );

    for (const subagent of subagents) {
      const artifact =
        REQUIREMENT_SUBAGENT_ARTIFACTS[
          subagent.name as keyof typeof REQUIREMENT_SUBAGENT_ARTIFACTS
        ];
      expect(artifact).toBeDefined();
      expect(subagent.systemPrompt).toContain(artifact);
      expect(subagent.systemPrompt).toContain("必须且只能调用一次 write_file");
      expect(subagent.systemPrompt).toContain("write_file 成功后不要回读文件");
      expect(subagent.middleware).toHaveLength(2);
      expect(subagent.permissions).toContainEqual({
        operations: ["write"],
        paths: [artifact],
      });
      expect(subagent.permissions).toContainEqual({
        operations: ["read", "write"],
        paths: ["/**"],
        mode: "deny",
      });
    }
  });

  test("the coordinator blocks task calls after the first three delegations", async () => {
    const model = fakeModel()
      .respondWithTools([
        {
          name: "task",
          args: {
            subagent_type: "requirement-analyst",
            description: "第一次委派",
          },
          id: "first-task",
        },
      ])
      .respond(new AIMessage("第一次分析完成"))
      .respondWithTools([
        {
          name: "task",
          args: {
            subagent_type: "requirement-analyst",
            description: "第二次委派",
          },
          id: "second-task",
        },
      ])
      .respond(new AIMessage("第二次分析完成"))
      .respondWithTools([
        {
          name: "task",
          args: {
            subagent_type: "requirement-analyst",
            description: "第三次委派",
          },
          id: "third-task",
        },
      ])
      .respond(new AIMessage("第三次分析完成"))
      .respondWithTools([
        {
          name: "task",
          args: {
            subagent_type: "requirement-analyst",
            description: "应被中间件拦截的第四次委派",
          },
          id: "blocked-fourth-task",
        },
      ])
      // DeepAgents may spend one response on history summarization before the
      // coordinator receives the artificial ToolMessage from the limiter.
      .respond(new AIMessage("收到限制，不再委派。"))
      .respond(new AIMessage("收到限制，不再委派。"))
      .respond(new AIMessage("收到限制，不再委派。"));

    const events: RuntimeEvent[] = [];
    let failure: unknown;
    try {
      for await (const event of streamRequirementWithModel(
        model,
        "验证委派次数限制",
        { runId: "task-limit-test", threadId: "task-limit-thread" },
      )) {
        events.push(event);
      }
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("未生成必需产物");
    expect(
      events.filter(
        (event) =>
          event.type === "progress" &&
          event.agent === "requirement-analyst" &&
          event.tool === undefined &&
          event.status === "started",
      ),
    ).toHaveLength(3);
  });

  test("parallel experts do not concurrently update a shared limiter state", async () => {
    const readSkill = (id: string) => ({
      name: "read_file",
      args: {
        file_path: "/skills/requirement-analysis/SKILL.md",
        offset: 0,
        limit: 1_000,
      },
      id,
    });
    const model = fakeModel()
      .respondWithTools([
        {
          name: "task",
          args: {
            subagent_type: "requirement-analyst",
            description: "并行分析需求",
          },
          id: "parallel-requirement-task",
        },
        {
          name: "task",
          args: {
            subagent_type: "risk-reviewer",
            description: "并行审查风险",
          },
          id: "parallel-risk-task",
        },
        {
          name: "task",
          args: {
            subagent_type: "acceptance-designer",
            description: "并行设计验收标准",
          },
          id: "parallel-acceptance-task",
        },
      ])
      .respondWithTools([readSkill("parallel-read-1")])
      .respondWithTools([readSkill("parallel-read-2")])
      .respondWithTools([readSkill("parallel-read-3")])
      .respond(new AIMessage("并行专家任务完成。"))
      .respond(new AIMessage("并行专家任务完成。"))
      .respond(new AIMessage("并行专家任务完成。"))
      .respond(new AIMessage("协调器结束离线并行测试。"));

    const events: RuntimeEvent[] = [];
    let failure: unknown;
    try {
      for await (const event of streamRequirementWithModel(
        model,
        "验证三个专家并行执行",
        { runId: "parallel-test", threadId: "parallel-thread" },
      )) {
        events.push(event);
      }
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("未生成必需产物");
    expect((failure as Error).message).not.toContain("Invalid update");
    expect(
      events.filter(
        (event) =>
          event.type === "progress" &&
          event.tool === undefined &&
          event.status === "completed" &&
          REQUIREMENT_SUBAGENT_NAMES.includes(
            event.agent as (typeof REQUIREMENT_SUBAGENT_NAMES)[number],
          ),
      ),
    ).toHaveLength(3);
  });

  test("custom tools cannot collide with DeepAgent built-ins", () => {
    const collidingTool = new DynamicStructuredTool({
      name: "read_file",
      description: "This name is reserved by the DeepAgent harness.",
      schema: z.object({}),
      func: async () => "never called",
    });

    try {
      createDeepAgent({ model: fakeModel(), tools: [collidingTool] });
      throw new Error("expected createDeepAgent to reject a tool collision");
    } catch (error) {
      expect(ConfigurationError.isInstance(error)).toBe(true);
      if (ConfigurationError.isInstance(error)) {
        expect(error.code).toBe("TOOL_NAME_COLLISION");
      }
    }
  });
});
