
import { z } from "zod";

// A price is rounded to cents first, so it must still be at least 0.01 after rounding (0.001 would store as 0.00).
// The cap keeps priceUSD inside Decimal(10,2); the service also checks the LBP result against Decimal(12,2).
export const MAX_PRICE_USD = 99_999;
const priceUSDSchema = z.coerce
  .number()
  .finite()
  .max(MAX_PRICE_USD)
  .refine((value) => Math.round(value * 100) >= 1, { message: "Price must be at least 0.01" });

// POST /api/menu-items
// Trim the name, require a category, and validate the USD price.
export const createMenuItemSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    categoryId: z.string().uuid(),
    priceUSD: priceUSDSchema,
    soldOut: z.boolean().optional(),
  })
  .strict();

// PATCH /api/menu-items/:id
// Allow updating only the fields provided.
export const updateMenuItemSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    categoryId: z.string().uuid().optional(),
    priceUSD: priceUSDSchema.optional(),
    soldOut: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided" },
  );

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

// The :id in /api/menu-items/:id/... is client input, so a malformed one is a 400 before any query.
export const menuItemIdSchema = z.object({ id: z.string().uuid() });
