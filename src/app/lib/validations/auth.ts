import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name cannot exceed 50 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^[0-9+\s()-]{7,20}$/, "Please enter a valid phone number").optional().or(z.literal('')),
  targetExam: z.string().max(100).optional(),
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
