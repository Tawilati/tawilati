
import { z } from "zod";

// POST /api/categories
// Trim surrounding whitespace and require a name between 1 and 50 characters.
export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(50),
  })
  .strict();

// PATCH /api/categories/:id
// Apply the same name rules when renaming an existing category.
export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(50),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// The :id in /api/categories/:id is client input, so a malformed one is a 400 before any query.
export const categoryIdSchema = z.object({ id: z.string().uuid() });
