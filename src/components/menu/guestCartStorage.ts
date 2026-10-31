import { z } from "zod";
import type { SubmitAttempt } from "./guestOrderApi";
import type { CartLine } from "@/utils/guestCart";

export type SavedCart = { lines: CartLine[]; attempt: SubmitAttempt | null; closed: boolean };
const line = z.object({ menuItemId: z.string().min(1), qty: z.number().int().min(1).max(99) });
const schema = z.object({
  lines: z.array(line.extend({ name: z.string() })).refine((lines) => new Set(lines.map((line) => line.menuItemId)).size === lines.length),
  attempt: z.object({ key: z.string().min(1).max(255), lines: z.array(line).min(1).max(50) }).nullable(),
  closed: z.boolean().default(false),
});
const EMPTY: SavedCart = { lines: [], attempt: null, closed: false };

export function parseSaved(raw: string | null): SavedCart {
  if (!raw) return EMPTY;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch { return EMPTY; }
}

// Browsing and editing still work when storage is unavailable. An order must have
// a durably saved attempt before it can be sent; the hook checks writeStored's result.
const memory = new Map<string, string>();
export function readStored(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try { return sessionStorage.getItem(key); }
  catch { return memory.get(key) ?? null; }
}
export function writeStored(key: string, value: string): boolean {
  try { sessionStorage.setItem(key, value); memory.delete(key); return true; }
  catch { memory.set(key, value); return false; }
}
