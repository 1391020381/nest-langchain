type Example = {
  script: string;
  file: string;
  doc: string;
};

type Stage = {
  title: string;
  summary: string;
  examples?: Example[];
  groups?: Array<{ label: string; examples: Example[] }>;
};

function rows(items: ReadonlyArray<readonly [string, string, string]>): Example[] {
  return items.map(([script, file, doc]) => ({ script, file, doc }));
}

const stages: Stage[] = [
  {
    title: "0 最小循环",
    summary: "createAgent({ model, tools })，invoke({ messages })",
    examples: [
      ["bun run quickstart", "src/quickstart/basic-agent.ts", "https://docs.langchain.com/oss/javascript/langchain/quickstart"],
      ["bun run quickstart:system-prompt", "src/quickstart/system-prompt.ts", "https://docs.langchain.com/oss/javascript/langchain/quickstart"],
      ["bun run quickstart:fetch-text-from-url", "src/quickstart/fetch-text-from-url.ts", "https://docs.langchain.com/oss/javascript/langchain/quickstart"],
      ["bun run quickstart:model", "src/quickstart/model.ts", "https://docs.langchain.com/oss/javascript/langchain/quickstart"],
      ["bun run quickstart:memory", "src/quickstart/memory.ts", "https://docs.langchain.com/oss/javascript/langchain/quickstart"],
      ["bun run quickstart:research-agent", "src/quickstart/research-agent.ts", "https://docs.langchain.com/oss/javascript/langchain/quickstart"],
    ].map(([script, file, doc]) => ({ script, file, doc })),
  },
  {
    title: "1 model",
    summary: "推理引擎。字符串或 chat model，先脱离 agent 看调用和工具循环",
    examples: [
      ["bun run models:init", "src/models/init.ts", "https://docs.langchain.com/oss/javascript/langchain/models"],
      ["bun run models:invocation", "src/models/invocation.ts", "https://docs.langchain.com/oss/javascript/langchain/models"],
      ["bun run models:tool-calling", "src/models/tool-calling.ts", "https://docs.langchain.com/oss/javascript/langchain/models"],
      ["bun run models:structured-output", "src/models/structured-output.ts", "https://docs.langchain.com/oss/javascript/langchain/models"],
      ["bun run models:advanced", "src/models/advanced.ts", "https://docs.langchain.com/oss/javascript/langchain/models"],
    ].map(([script, file, doc]) => ({ script, file, doc })),
  },
  {
    title: "2 tools",
    summary: "模型可执行的动作。返回值变成 ToolMessage",
    examples: [
      ["bun run tools:return-string", "src/tools/return-string.ts", "https://docs.langchain.com/oss/javascript/langchain/tools"],
      ["bun run tools:return-object", "src/tools/return-object.ts", "https://docs.langchain.com/oss/javascript/langchain/tools"],
      ["bun run tools:return-multimodal", "src/tools/return-multimodal.ts", "https://docs.langchain.com/oss/javascript/langchain/tools"],
      ["bun run tools:return-command", "src/tools/return-command.ts", "https://docs.langchain.com/oss/javascript/langchain/tools"],
      ["bun run tools:return-direct", "src/tools/return-direct.ts", "https://docs.langchain.com/oss/javascript/langchain/tools"],
      ["bun run tools:context", "src/tools/context.ts", "https://docs.langchain.com/oss/javascript/langchain/tools"],
      ["bun run tools:store", "src/tools/store.ts", "https://docs.langchain.com/oss/javascript/langchain/tools"],
      ["bun run tools:errors", "src/tools/errors.ts", "https://docs.langchain.com/oss/javascript/langchain/tools"],
      ["bun run tools:dynamic", "src/tools/dynamic.ts", "https://docs.langchain.com/oss/javascript/langchain/tools"],
    ].map(([script, file, doc]) => ({ script, file, doc })),
  },
  {
    title: "3 messages 与 systemPrompt",
    summary: "循环里的对话状态。systemPrompt 在构造时写入",
    examples: [
      ["bun run messages:basic", "src/messages/basic.ts", "https://docs.langchain.com/oss/javascript/langchain/messages"],
      ["bun run messages:types", "src/messages/types.ts", "https://docs.langchain.com/oss/javascript/langchain/messages"],
      ["bun run messages:content", "src/messages/content.ts", "https://docs.langchain.com/oss/javascript/langchain/messages"],
      ["bun run messages:notifications", "src/messages/notifications.ts", "https://docs.langchain.com/oss/javascript/langchain/messages"],
      ["bun run messages:serialization", "src/messages/serialization.ts", "https://docs.langchain.com/oss/javascript/langchain/messages"],
      ["bun run agents:system-prompt", "src/agents/system-prompt.ts", "https://docs.langchain.com/oss/javascript/langchain/agents"],
    ].map(([script, file, doc]) => ({ script, file, doc })),
  },
  {
    title: "4 responseFormat",
    summary: "结束时交出 structuredResponse",
    examples: [
      ["bun run agents:structured-output", "src/agents/structured-output.ts", "https://docs.langchain.com/oss/javascript/langchain/agents"],
      ["bun run structured:provider", "src/structured-output/provider.ts", "https://docs.langchain.com/oss/javascript/langchain/structured-output"],
      ["bun run structured:tool", "src/structured-output/tool.ts", "https://docs.langchain.com/oss/javascript/langchain/structured-output"],
      ["bun run structured:tool-message", "src/structured-output/tool-message.ts", "https://docs.langchain.com/oss/javascript/langchain/structured-output"],
      ["bun run structured:errors", "src/structured-output/errors.ts", "https://docs.langchain.com/oss/javascript/langchain/structured-output"],
      ["bun run structured:refusal", "src/structured-output/refusal.ts", "https://docs.langchain.com/oss/javascript/langchain/structured-output"],
      ["bun run structured:fixing-parser", "src/structured-output/fixing-parser.ts", "https://docs.langchain.com/oss/javascript/langchain/structured-output"],
    ].map(([script, file, doc]) => ({ script, file, doc })),
  },
  {
    title: "5 Middleware",
    summary: "钩子读的是同一份 state。调用和自定义字段先放在这里，后面的护栏和人工接入都挂在 middleware 数组上",
    groups: [
      {
        label: "调用与状态",
        examples: rows([
          ["bun run agents:invocation", "src/agents/invocation.ts", "https://docs.langchain.com/oss/javascript/langchain/agents"],
          ["bun run agents:agent-state", "src/agents/agent-state.ts", "https://docs.langchain.com/oss/javascript/langchain/agents"],
          ["bun run agents:streaming", "src/agents/streaming.ts", "https://docs.langchain.com/oss/javascript/langchain/agents"],
        ]),
      },
      {
        label: "钩子",
        examples: rows([
          ["bun run middleware:hooks", "src/middleware/hooks.ts", "https://docs.langchain.com/oss/javascript/langchain/middleware/overview"],
        ]),
      },
    ],
  },
  {
    title: "6 短期记忆",
    summary: "checkpointer 按 thread_id 保存这一条对话。裁剪发生在模型调用之前",
    examples: rows([
      ["bun run memory:checkpointer", "src/short-term-memory/checkpointer.ts", "https://docs.langchain.com/oss/javascript/langchain/short-term-memory"],
      ["bun run memory:thread", "src/short-term-memory/thread.ts", "https://docs.langchain.com/oss/javascript/langchain/short-term-memory"],
      ["bun run memory:trim", "src/short-term-memory/trim.ts", "https://docs.langchain.com/oss/javascript/langchain/short-term-memory"],
    ]),
  },
  {
    title: "7 Streaming 与 Event streaming",
    summary: "stream 按 streamMode 看增量。streamEvents 是另一页，把同一次运行投影成消息、工具、子代理和状态",
    groups: [
      {
        label: "Streaming",
        examples: rows([
          ["bun run streaming:progress", "src/streaming/progress.ts", "https://docs.langchain.com/oss/javascript/langchain/streaming"],
          ["bun run streaming:tokens", "src/streaming/tokens.ts", "https://docs.langchain.com/oss/javascript/langchain/streaming"],
          ["bun run streaming:custom", "src/streaming/custom.ts", "https://docs.langchain.com/oss/javascript/langchain/streaming"],
          ["bun run streaming:modes", "src/streaming/modes.ts", "https://docs.langchain.com/oss/javascript/langchain/streaming"],
          ["bun run streaming:reasoning", "src/streaming/reasoning.ts", "https://docs.langchain.com/oss/javascript/langchain/streaming"],
          ["bun run streaming:disable", "src/streaming/disable.ts", "https://docs.langchain.com/oss/javascript/langchain/streaming"],
        ]),
      },
      {
        label: "Event streaming",
        examples: rows([
          ["bun run events:messages", "src/event-streaming/messages.ts", "https://docs.langchain.com/oss/javascript/langchain/event-streaming"],
          ["bun run events:reasoning", "src/event-streaming/reasoning.ts", "https://docs.langchain.com/oss/javascript/langchain/event-streaming"],
          ["bun run events:tool-calls", "src/event-streaming/tool-calls.ts", "https://docs.langchain.com/oss/javascript/langchain/event-streaming"],
          ["bun run events:subagents", "src/event-streaming/subagents.ts", "https://docs.langchain.com/oss/javascript/langchain/event-streaming"],
          ["bun run events:state", "src/event-streaming/state.ts", "https://docs.langchain.com/oss/javascript/langchain/event-streaming"],
          ["bun run events:projections", "src/event-streaming/projections.ts", "https://docs.langchain.com/oss/javascript/langchain/event-streaming"],
          ["bun run events:extensions", "src/event-streaming/extensions.ts", "https://docs.langchain.com/oss/javascript/langchain/event-streaming"],
        ]),
      },
    ],
  },
  {
    title: "8 Guardrails → Human-in-the-loop → 长期记忆 → MCP → Multi-agent",
    summary: "护栏和人工接入是 middleware。长期记忆是 store，跨 thread。MCP 把外部工具装进 tools。多智能体是多个 createAgent 的组合方式",
    groups: [
      {
        label: "Guardrails",
        examples: rows([
          ["bun run guardrails:pii", "src/guardrails/pii.ts", "https://docs.langchain.com/oss/javascript/langchain/guardrails"],
          ["bun run guardrails:block", "src/guardrails/block.ts", "https://docs.langchain.com/oss/javascript/langchain/guardrails"],
          ["bun run guardrails:before-agent", "src/guardrails/before-agent.ts", "https://docs.langchain.com/oss/javascript/langchain/guardrails"],
        ]),
      },
      {
        label: "Human-in-the-loop",
        examples: rows([
          ["bun run hitl:approve", "src/human-in-the-loop/approve.ts", "https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop"],
          ["bun run hitl:reject", "src/human-in-the-loop/reject.ts", "https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop"],
        ]),
      },
      {
        label: "长期记忆",
        examples: rows([
          ["bun run memory:long-term", "src/long-term-memory/store.ts", "https://docs.langchain.com/oss/javascript/langchain/long-term-memory"],
          ["bun run tools:store", "src/tools/store.ts", "https://docs.langchain.com/oss/javascript/langchain/tools"],
        ]),
      },
      {
        label: "MCP",
        examples: rows([
          ["bun run mcp:tools", "src/mcp/tools.ts", "https://docs.langchain.com/oss/javascript/langchain/mcp/tools"],
          ["bun run mcp:connections", "src/mcp/connections.ts", "https://docs.langchain.com/oss/javascript/langchain/mcp/connections"],
          ["bun run mcp:auth", "src/mcp/auth.ts", "https://docs.langchain.com/oss/javascript/langchain/mcp/auth"],
        ]),
      },
      {
        label: "Multi-agent",
        examples: rows([
          ["bun run multi-agent:subagent", "src/multi-agent/subagent.ts", "https://docs.langchain.com/oss/javascript/langchain/multi-agent/subagents"],
          ["bun run multi-agent:handoff", "src/multi-agent/handoff.ts", "https://docs.langchain.com/oss/javascript/langchain/multi-agent/handoffs"],
          ["bun run multi-agent:skills", "src/multi-agent/skills.ts", "https://docs.langchain.com/oss/javascript/langchain/multi-agent/skills"],
          ["bun run multi-agent:router", "src/multi-agent/router.ts", "https://docs.langchain.com/oss/javascript/langchain/multi-agent/router"],
          ["bun run multi-agent:workflow", "src/multi-agent/workflow.ts", "https://docs.langchain.com/oss/javascript/langchain/multi-agent/custom-workflow"],
        ]),
      },
    ],
  },
];

console.log("LangChain 学习路径");
console.log("Agent = Model + Harness。按 createAgent 的参数往下走。\n");
for (const stage of stages) {
  console.log(stage.title);
  console.log(`  ${stage.summary}`);
  const groups = stage.groups ?? [{ label: "", examples: stage.examples ?? [] }];
  for (const group of groups) {
    if (group.label) console.log(`  ${group.label}`);
    const pad = group.label ? "    " : "  ";
    for (const example of group.examples) {
      console.log(`${pad}${example.script}`);
      console.log(`${pad}  ${example.file}`);
      console.log(`${pad}  ${example.doc}`);
    }
  }
  console.log("");
}
