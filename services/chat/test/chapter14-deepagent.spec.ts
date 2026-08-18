/**
 * 第十四章 DeepAgent 配套测试
 *
 * Layer 1：零 LLM 依赖
 * - Python 工具 JSON in/out
 * - listSkills 解析 SKILL.md frontmatter
 * - createDeepAgent 可创建（含 FilesystemBackend + skills）
 * - 虚拟文件系统写读
 *
 * Layer 2：真实模型，需 OPENAI_API_KEY 且 RUN_LLM_DEEPAGENT_TESTS=1
 */
import { describe, expect, it } from "bun:test";
import { createDeepAgent, FilesystemBackend, listSkills } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { config } from "dotenv";
import { callPythonTool, SKILLS_DIR } from "../src/skills/call-python-tool";

config({ path: join(import.meta.dir, "../.env") });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const LLM_DEEPAGENT_TEST_MODEL =
  process.env.LLM_DEEPAGENT_TEST_MODEL || process.env.DEEPAGENT_MODEL || "gpt-5.4";
const RUN_LLM_DEEPAGENT_TESTS = process.env.RUN_LLM_DEEPAGENT_TESTS === "1";
const SKIP_LLM = !OPENAI_API_KEY || !RUN_LLM_DEEPAGENT_TESTS;

if (SKIP_LLM) {
  console.warn("⚠️ Layer 2 将跳过：需要 OPENAI_API_KEY 且 RUN_LLM_DEEPAGENT_TESTS=1");
}

function testModel() {
  return new ChatOpenAI({
    model: LLM_DEEPAGENT_TEST_MODEL,
    temperature: 0,
    apiKey: OPENAI_API_KEY || "sk-test",
    configuration: OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : undefined,
  });
}

const researchTools = [
  new DynamicStructuredTool({
    name: "search_competitors",
    description: "搜索竞品信息，返回竞品名称、定位、定价等关键信息。",
    schema: z.object({ query: z.string().describe("搜索关键词") }),
    func: async ({ query }) =>
      callPythonTool("competitor-research", "search_competitors.py", { query }),
  }),
  new DynamicStructuredTool({
    name: "search_best_practices",
    description: "搜索行业最佳实践和常见做法。",
    schema: z.object({ topic: z.string().describe("搜索主题") }),
    func: async ({ topic }) =>
      callPythonTool("competitor-research", "search_best_practices.py", {
        topic,
      }),
  }),
];

const analysisTools = [
  new DynamicStructuredTool({
    name: "analyze_completeness",
    description: "分析需求描述的完整性，从六个维度检查是否缺少关键信息。",
    schema: z.object({
      requirementText: z.string().describe("需求描述文本"),
    }),
    func: async ({ requirementText }) =>
      callPythonTool("requirement-analysis", "analyze_completeness.py", {
        requirementText,
      }),
  }),
  new DynamicStructuredTool({
    name: "estimate_complexity",
    description: "估算需求的技术复杂度，返回 T-shirt size 和预计工期。",
    schema: z.object({ requirementText: z.string().describe("需求描述") }),
    func: async ({ requirementText }) =>
      callPythonTool("requirement-analysis", "estimate_complexity.py", {
        requirementText,
      }),
  }),
];

describe("14.4 Hello World：createDeepAgent 最小构造", () => {
  it("单工具 + systemPrompt 即可创建 Agent", () => {
    const getWeather = new DynamicStructuredTool({
      name: "get_weather",
      description: "获取指定城市的天气",
      schema: z.object({ city: z.string().describe("城市名") }),
      func: async ({ city }) => `${city}：晴，28°C，微风`,
    });

    const agent = createDeepAgent({
      model: testModel(),
      tools: [getWeather],
      systemPrompt: "你是一个天气助手。用户问天气时，调用 get_weather 工具获取数据。",
    });

    expect(typeof agent.invoke).toBe("function");
    expect(typeof agent.streamEvents).toBe("function");
  });
});

describe("14.5 Python 工具独立验证", () => {
  it("search_competitors.py 返回多个竞品", () => {
    const parsed = JSON.parse(
      callPythonTool("competitor-research", "search_competitors.py", {
        query: "项目管理工具",
      }),
    );
    expect(Array.isArray(parsed.results)).toBe(true);
    expect(parsed.results.length).toBeGreaterThan(1);
    expect(parsed.results[0].name).toBeTruthy();
  });

  it("search_best_practices.py 返回最佳实践", () => {
    const parsed = JSON.parse(
      callPythonTool("competitor-research", "search_best_practices.py", {
        topic: "项目管理",
      }),
    );
    expect(Array.isArray(parsed.practices)).toBe(true);
    expect(parsed.practices.length).toBeGreaterThan(0);
    expect(parsed.practices[0].title).toBeTruthy();
  });

  it("analyze_completeness.py 返回完整性评分", () => {
    const parsed = JSON.parse(
      callPythonTool("requirement-analysis", "analyze_completeness.py", {
        requirementText:
          "作为管理员，我需要能够批量导入用户数据，支持 Excel 和 CSV 格式，单次最多导入 1 万行",
      }),
    );
    expect(parsed.completenessScore).toBeGreaterThan(0);
    expect(parsed.coveredDimensions.length).toBeGreaterThan(0);
  });

  it("estimate_complexity.py 返回复杂度估算", () => {
    const parsed = JSON.parse(
      callPythonTool("requirement-analysis", "estimate_complexity.py", {
        requirementText: "批量导入用户数据，需要第三方 API 集成",
      }),
    );
    expect(parsed.size).toMatch(/^[SMLX]{1,2}$/);
    expect(parsed.factors.length).toBeGreaterThan(0);
  });
});

describe("14.7 虚拟文件系统：FilesystemBackend 基本写读", () => {
  it("写入文件后可读回，路径落到真实磁盘", async () => {
    const root = mkdtempSync(join(tmpdir(), "ch14-vfs-"));
    try {
      const backend = new FilesystemBackend({ rootDir: root, virtualMode: true });
      const w = await backend.write("/analysis/completeness.md", "完整性评分：67 / 100");
      expect(w.error).toBeUndefined();
      expect(existsSync(join(root, "analysis", "completeness.md"))).toBe(true);

      const r = await backend.read("/analysis/completeness.md");
      expect(r.error).toBeUndefined();
      expect(String(r.content)).toContain("完整性评分");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("virtualMode 阻止 .. 越界", async () => {
    const root = mkdtempSync(join(tmpdir(), "ch14-vfs-"));
    try {
      const backend = new FilesystemBackend({ rootDir: root, virtualMode: true });
      await backend.write("/../escape.txt", "should not escape");
      expect(existsSync(join(root, "..", "escape.txt"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("14.9 Skills 资产可被 DeepAgent 发现", () => {
  it("listSkills 从磁盘解析两个 Skill 的 frontmatter", () => {
    const skills = listSkills({ projectSkillsDir: SKILLS_DIR });
    const names = skills.map((s) => s.name);
    expect(names).toContain("requirement-analysis");
    expect(names).toContain("competitor-research");
    for (const skill of skills) {
      expect(skill.description.length).toBeGreaterThan(0);
    }
  });
});

describe("14.3 / 14.9 createDeepAgent 能创建 Agent", () => {
  it("最小配置（仅 tools）", () => {
    const agent = createDeepAgent({
      model: testModel(),
      tools: researchTools,
      systemPrompt: "你是产品调研分析师。",
    });
    expect(typeof agent.invoke).toBe("function");
  });

  it("含 FilesystemBackend + skills 配置", () => {
    const agent = createDeepAgent({
      model: testModel(),
      tools: [...researchTools, ...analysisTools],
      backend: new FilesystemBackend({ rootDir: process.cwd() }),
      skills: [SKILLS_DIR],
      systemPrompt: "你是产品调研分析师。需要专业能力时，可以加载对应 skill。",
    });
    expect(typeof agent.invoke).toBe("function");
  });
});

describe("14.4 Hello World 端到端", () => {
  if (SKIP_LLM) {
    it.skip("需要 OPENAI_API_KEY 且 RUN_LLM_DEEPAGENT_TESTS=1", () => {});
    return;
  }

  it("DeepAgent 调用 get_weather → 返回天气 + todos/files 为空", async () => {
    const getWeather = new DynamicStructuredTool({
      name: "get_weather",
      description: "获取指定城市的天气",
      schema: z.object({ city: z.string().describe("城市名") }),
      func: async ({ city }) => `${city}：晴，28°C，微风`,
    });

    const agent = createDeepAgent({
      model: testModel(),
      tools: [getWeather],
      systemPrompt: "你是一个天气助手。用户问天气时，调用 get_weather 工具获取数据。",
    });

    const result = await agent.invoke({
      messages: [{ role: "user", content: "北京今天天气怎么样？" }],
    });

    const toolCalls = result.messages
      .filter((m: { tool_calls?: { name: string }[] }) => (m.tool_calls?.length ?? 0) > 0)
      .flatMap((m: { tool_calls?: { name: string }[] }) =>
        (m.tool_calls ?? []).map((tc) => tc.name),
      );
    const output = result.messages[result.messages.length - 1].content.toString();

    expect(toolCalls).toContain("get_weather");
    expect(output).toMatch(/28|天气|晴/);
    expect(result.todos ?? []).toEqual([]);
    expect(Object.keys(result.files ?? {})).toEqual([]);
  }, 60000);
});

describe("14.5 调研 Agent 端到端", () => {
  if (SKIP_LLM) {
    it.skip("需要 OPENAI_API_KEY 且 RUN_LLM_DEEPAGENT_TESTS=1", () => {});
    return;
  }

  it("DeepAgent 调用 search_competitors，输出含竞品/项目管理且长度大于 300", async () => {
    const agent = createDeepAgent({
      model: testModel(),
      tools: researchTools,
      systemPrompt:
        "你是一位产品调研分析师。你的任务是调研竞品信息，并输出结构清晰、可用于产品决策的竞品分析报告。",
    });

    const result = await agent.invoke({
      messages: [
        {
          role: "user",
          content: "调研中小团队项目管理工具竞品，我们想做一个轻量级项目管理工具。",
        },
      ],
    });

    const toolCalls = result.messages
      .filter((m: { tool_calls?: { name: string }[] }) => (m.tool_calls?.length ?? 0) > 0)
      .flatMap((m: { tool_calls?: { name: string }[] }) =>
        (m.tool_calls ?? []).map((tc) => tc.name),
      );
    const output = result.messages[result.messages.length - 1].content.toString();

    expect(toolCalls).toContain("search_competitors");
    expect(output).toMatch(/竞品|项目管理/);
    expect(output.length).toBeGreaterThan(300);
  }, 180000);
});
