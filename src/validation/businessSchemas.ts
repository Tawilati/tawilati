import { z } from "zod";

// The timezones a business can pick.
export const TIMEZONES = ["Asia/Beirut", "Asia/Dubai", "Europe/Paris", "UTC"] as const;

// PATCH /api/business (OWNER): the exchange rate and/or the timezone, at least one.
// Only the shape is checked here; the service checks the values and answers
// invalid_exchange_rate / invalid_timezone. Not editable: name, slug, businessId.
export const updateBusinessSchema = z
  .object({
    exchangeRate: z.coerce.number().finite().optional(),
    timezone: z.string().trim().optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided" },
  );

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
