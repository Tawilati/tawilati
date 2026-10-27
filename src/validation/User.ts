import { z } from "zod";

export const registerUserRequestSchema = z.object({
  businessName: z.string().trim().min(1).max(100),
  ownerName: z.string().trim().min(1).max(100),
  email: z.string().trim().max(254).pipe(z.email()),
  password: z.string().min(8),
});
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Email is required" })
    .email({ message: "Invalid email format" })
    .max(255, { message: "Email is too long" }),
  password: z
    .string()
    .trim()
    .min(1, { message: "Password is required" })
    .min(6, { message: "Password must be at least 6 characters" })
    .max(100, { message: "Password is too long" }),
});
export type RegisterUserRequest = z.infer<typeof registerUserRequestSchema>;
