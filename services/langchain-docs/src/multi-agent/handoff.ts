/**
 * https://docs.langchain.com/oss/javascript/langchain/multi-agent/handoffs
 * A tool writes currentStep. The next model call reads that field and
 * changes the system prompt. The same agent keeps the conversation.
 */
import { ToolMessage } from "@langchain/core/messages";
import { Command, MemorySaver } from "@langchain/langgraph";
import { createAgent, createMiddleware, tool, type ToolRuntime } from "langchain";
import * as z from "zod";
import { docsModel } from "../model";

const StepState = z.object({
  currentStep: z.string().default("triage"),
});

const steps: string[] = [];

const recordWarranty = tool(
  async ({ status }, runtime: ToolRuntime) => {
    console.log(`[tool] status=${status}`);
    return new Command({
      update: {
        currentStep: "specialist",
        messages: [
          new ToolMessage({
            content: `Warranty status recorded: ${status}`,
            tool_call_id: runtime.toolCallId,
            name: "record_warranty",
          }),
        ],
      },
    });
  },
  {
    name: "record_warranty",
    description: "Record warranty status and move to the specialist step. Call this once.",
    schema: z.object({ status: z.string() }),
  },
);

const applyStep = createMiddleware({
  name: "ApplyStep",
  stateSchema: StepState,
  wrapModelCall: (request, handler) => {
    const step = request.state.currentStep || "triage";
    steps.push(step);
    console.log(`[step] ${step}`);
    const called = request.messages.some((message) => message.type === "tool");
    return handler({
      ...request,
      systemPrompt:
        step === "specialist"
          ? "The warranty is already recorded. Reply with exactly: specialist."
          : "Call record_warranty once with status in_warranty.",
      toolChoice: called || step === "specialist" ? "auto" : "required",
    });
  },
});

const agent = createAgent({
  model: docsModel(),
  tools: [recordWarranty],
  middleware: [applyStep],
  checkpointer: new MemorySaver(),
});

const config = { configurable: { thread_id: "handoff" }, recursionLimit: 8 };

await agent.invoke(
  { messages: [{ role: "user", content: "My phone is broken and it is in warranty." }] },
  config,
);

const followUp = await agent.invoke(
  { messages: [{ role: "user", content: "What step are we on?" }] },
  config,
);

if (!steps.includes("specialist")) {
  throw new Error(`currentStep never became specialist: ${steps.join(" -> ")}`);
}
console.log(`[steps] ${steps.join(" -> ")}`);
console.log(`[answer] ${followUp.messages.at(-1)?.text ?? ""}`);
