import crypto from "crypto";
import type { OrderLineInput } from "@/types/Order";

/**
 * Compute a canonical SHA-256 fingerprint of the order lines.
 *
 * Why canonical?
 *   [{ burger, 2 }, { pizza, 1 }] and [{ pizza, 1 }, { burger, 2 }]
 *   are the SAME logical order. They MUST produce the SAME hash.
 *   We sort by menuItemId before hashing.
 *
 * What is included?
 *   - menuItemId  (what was ordered)
 *   - qty         (how many)
 *
 * What is EXCLUDED (intentionally)?
 *   - priceUSD / priceLBP  → prices come from the DB, not the client
 *   - rateSnapshot         → comes from Business.exchangeRate
 *   - guest identity       → different guests can order the same items
 *   - timestamps           → the same order can be retried at any time
 *
 * @param lines - The items the guest is trying to order
 * @returns A 64-character hex string (SHA-256)
 */
export function hashOrderLines(lines: OrderLineInput[]): string {
  const canonical = [...lines]
    .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId))
    .map((l) => `${l.menuItemId}:${l.qty}`)
    .join("|");

  return crypto.createHash("sha256").update(canonical).digest("hex");
}