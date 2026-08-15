import { z } from "zod";

export const generatedMCQSchema = z.array(z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().optional().default(''),
  difficulty: z.string().optional().default('medium'),
  proofQuote: z.string().optional().default(''),
  pageReference: z.string().optional().default(''),
  citationType: z.enum(['VERBATIM_PROOF', 'LOGICAL_DEDUCTION']).optional().default('VERBATIM_PROOF'),
}));

export const testAttemptSchema = z.object({
  testId: z.string().optional(),
  id: z.string().optional(),
  answers: z.array(z.number().int())
});
