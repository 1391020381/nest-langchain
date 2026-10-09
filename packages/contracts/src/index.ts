import { z } from "zod";

export const APP_NAME = "llm";

export const RequirementSchema = z.object({
  input: z
    .string()
    .trim()
    .min(1, "input is required")
    .max(4000, "input must be at most 4000 characters"),
}).strict();

export const RequirementResultSchema = z.object({
  action: z.string().trim().min(1).describe("唯一核心动作"),
  constraints: z.array(z.string().trim().min(1)).describe("明确约束条件"),
  entities: z.array(z.string().trim().min(1)).describe("关键实体"),
}).strict();

export type RequirementInput = z.infer<typeof RequirementSchema>;
export type RequirementResult = z.infer<typeof RequirementResultSchema>;
