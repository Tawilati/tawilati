
import { z } from "zod";

// POST /api/tables
export const createTableSchema = z
  .object({
    label: z.string().trim().min(1).max(50),
  })
  .strict();

// PATCH /api/tables/:id
export const updateTableSchema = z
  .object({
    label: z.string().trim().min(1).max(50),
  })
  .strict();

// Used to validate /api/tables/:id route parameters.
export const tableIdSchema = z.object({
  id: z.string().uuid(),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
