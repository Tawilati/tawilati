import { z } from "zod";
import { passwordSchema } from "@/validation/User";

// Owners create waiters and kitchen staff only; "OWNER" is a validation_error.
export const staffRoleSchema = z.enum(["WAITER", "KITCHEN"]);

// No id here: the database generates it. Not .strict(): a businessId sent in the body is
// dropped, never used (it comes from the session).
export const createStaffSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: passwordSchema,
  role: staffRoleSchema,
});

// PATCH /api/staff/:id: any of the three, at least one.
export const updateStaffSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    role: staffRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Nothing to update",
  });

// The :id in the URL is client input, so a malformed one is a 400 before any query.
export const staffIdSchema = z.object({ id: z.string() });

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
