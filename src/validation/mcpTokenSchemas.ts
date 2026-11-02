import { z } from "zod";

export const createMcpTokenSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
  })
  .strict();

export const mcpTokenIdSchema = z.object({ id: z.string().uuid() });
