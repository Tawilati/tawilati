import { z } from "zod";
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "@/utils/slug";

// GET /api/menu?b={businessSlug}&t={qrToken}
export const publicMenuQuerySchema = z
  .object({
    b: z.string().max(SLUG_MAX_LENGTH).regex(SLUG_PATTERN),
    t: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .transform(({ b, t }) => ({ businessSlug: b, qrToken: t }));

export type PublicMenuQuery = z.infer<typeof publicMenuQuerySchema>;
