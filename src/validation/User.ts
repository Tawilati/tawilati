import { z } from "zod";

// The sign-up password rules. The register form lists them under the field and ticks each one as
// it is met; the schema below enforces the same list, so the two can't drift apart.
export const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (password: string) => password.length >= 8 },
  { label: "A letter", test: (password: string) => /\p{L}/u.test(password) },
  { label: "A number", test: (password: string) => /\d/.test(password) },
] as const;

// 2 to 100 characters with at least one letter (any script, so Arabic names are fine).
export const businessNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/\p{L}/u, { message: "Must contain a letter" });

// Used at sign-up and when an owner creates a staff account.
export const passwordSchema = z
  .string()
  .max(100)
  .refine((password) => PASSWORD_RULES.every((rule) => rule.test(password)), {
    message: "Use at least 8 characters, with a letter and a number",
  });

export const registerUserRequestSchema = z.object({
  businessName: businessNameSchema,
  ownerName: z.string().trim().min(1).max(100),
  email: z.string().trim().max(254).pipe(z.email()),
  password: passwordSchema,
});

// GET /api/auth/business-name?name=...: is this name still free?
export const businessNameQuerySchema = z.object({ name: businessNameSchema });
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Email is required" })
    .email({ message: "Invalid email format" })
    .max(255, { message: "Email is too long" }),
  // No trim and no length rule here: the password is checked as typed, and a
  // wrong one gets the same invalid_credentials as an unknown email.
  password: z
    .string()
    .min(1, { message: "Password is required" })
    .max(100, { message: "Password is too long" }),
});
export type RegisterUserRequest = z.infer<typeof registerUserRequestSchema>;
