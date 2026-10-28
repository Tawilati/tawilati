
import { z } from "zod";

// POST /api/menu-items
// Trim the name, require a category, and validate the USD price.
export const createMenuItemSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    categoryId: z.string().uuid(),
    priceUSD: z.coerce.number().finite().positive(),
    soldOut: z.boolean().optional(),
  })
  .strict();

// PATCH /api/menu-items/:id
// Allow updating only the fields provided.
export const updateMenuItemSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    categoryId: z.string().uuid().optional(),
    priceUSD: z.coerce.number().finite().positive().optional(),
    soldOut: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided" },
  );

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
