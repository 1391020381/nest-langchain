import { z } from "zod";

export const AgentRunRequestSchema = z.object({
  input: z.string().trim().min(1, "input is required").max(20_000),
  threadId: z.string().trim().min(1).max(128).optional(),
});

export type AgentRunRequest = z.infer<typeof AgentRunRequestSchema>;

export const AgentTodoSchema = z.object({
  content: z.string(),
  status: z.enum(["pending", "in_progress", "completed"]),
});

export type AgentTodo = z.infer<typeof AgentTodoSchema>;

const EventEnvelopeSchema = z.object({
  runId: z.string(),
  threadId: z.string(),
  timestamp: z.string().datetime(),
});

export const RunStartedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("run.started"),
});

export const ProgressEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("progress"),
  agent: z.string(),
  tool: z.string().optional(),
  status: z.enum(["started", "completed", "failed"]),
  message: z.string().optional(),
});

export const ArtifactEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("artifact"),
  path: z.string(),
  content: z.string(),
});

export const FinalEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("final"),
  report: z.string(),
  todos: z.array(AgentTodoSchema),
  artifacts: z.record(z.string()),
  usedAgents: z.array(z.string()),
  toolCalls: z.array(z.string()),
});

export const ErrorEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("error"),
  code: z.string(),
  message: z.string(),
});

export const DoneEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("done"),
});

export const AgentStreamEventSchema = z.discriminatedUnion("type", [
  RunStartedEventSchema,
  ProgressEventSchema,
  ArtifactEventSchema,
  FinalEventSchema,
  ErrorEventSchema,
  DoneEventSchema,
]);

export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;

export function encodeSseEvent(event: AgentStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
