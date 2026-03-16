import { z } from "zod";

export const generatedMCQSchema = z.array(z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().optional(),
  difficulty: z.string().optional()
}));

export const testAttemptSchema = z.object({
  testId: z.string().optional(), // Can optionally allow from body if overriding
  answers: z.array(z.number().int().nullable().optional())
});
