import { z } from "zod";
import { objectIdSchema } from "./common";

export const generatedMCQSchema = z.array(z.object({
  question: z.string().min(1).max(5000),
  options: z.array(z.string().min(1).max(1000)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().optional().default(''),
  difficulty: z.string().optional().default('medium'),
  proofQuote: z.string().optional().default(''),
  pageReference: z.string().optional().default(''),
  citationType: z.enum(['VERBATIM_PROOF', 'LOGICAL_DEDUCTION']).optional().default('VERBATIM_PROOF'),
}).strict());

export const testAttemptSchema = z.object({
  testId: objectIdSchema.optional(),
  id: objectIdSchema.optional(),
  answers: z.array(z.number().int().min(-1).max(10)),
  timeTaken: z.number().nonnegative().max(86400).optional(),
}).strict();

