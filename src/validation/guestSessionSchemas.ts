import { z } from "zod";

export const createGuestSessionSchema = z
  .object({
    qrToken: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

export type CreateGuestSessionInput = z.infer<typeof createGuestSessionSchema>;
