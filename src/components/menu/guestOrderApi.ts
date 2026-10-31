// Sends the guest's cart to the kitchen: POST /api/guest-sessions when this phone has no token yet,
// then POST /api/orders. Error codes stop here; the screen only sees what happened.
import type { OrderResponse } from "@/types/Order";
import type { OrderLine } from "@/utils/guestCart";
import { z } from "zod";

export type TokenStore = {
  get: () => string | null;
  set: (token: string) => void;
  clear: () => void;
};

// One submit, kept until the server gives a final answer, so a retry can never make a second ticket.
export type SubmitAttempt = { key: string; lines: OrderLine[] };

export type PlacedOrder = Pick<OrderResponse, "orderId" | "tableLabel" | "status" | "totalUSD" | "totalLBP" | "lines">;

export type SubmitOutcome =
  | { kind: "sent"; order: PlacedOrder; sentLines: OrderLine[]; earlierAttempt: boolean }
  | { kind: "blocked" }
  | { kind: "tab_closed" }
  | { kind: "table_problem"; problem: "invalid_qr" | "table_disabled" }
  | { kind: "failed"; keepAttempt: boolean; reason?: "storage_unavailable" };

type Reply = { status: number; code: string; data: unknown };

const BLOCKING_CODES = ["menu_item_sold_out", "menu_item_archived", "menu_item_not_found"];
const TAB_CLOSED_CODES = ["guest_session_revoked", "table_session_closed"];
const amount = z.string().regex(/^\d+(\.\d{1,2})?$/);
const orderSchema = z.object({
  orderId: z.string().min(1), tableLabel: z.string().min(1),
  status: z.enum(["NEW", "PREPARING", "READY", "SERVED", "CANCELLED"]),
  totalUSD: amount, totalLBP: amount,
  lines: z.array(z.object({
    menuItemId: z.string().min(1), name: z.string(), qty: z.number().int().min(1).max(99),
    priceUSD: amount, priceLBP: amount,
  })).min(1).max(50),
});

// null when the server couldn't be reached.
async function post(url: string, headers: Record<string, string>, body: unknown): Promise<Reply | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success !== true) return null;
    return { status: res.status, code: json?.message ?? "", data: json?.data };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Sends the order with this phone's token. A token the server no longer accepts (expired) is
// renewed once; the idempotency key stays the same, so it still can't make a second ticket.
async function sendOrder(
  qrToken: string,
  lines: OrderLine[],
  key: string,
  tokens: TokenStore,
): Promise<Reply | Exclude<SubmitOutcome, { kind: "sent" }> | null> {
  let reply: Reply | null = null;

  for (let tries = 0; tries < 2; tries++) {
    let token = tokens.get();
    if (!token) {
      const session = await post("/api/guest-sessions", {}, { qrToken });
      if (!session) return null;
      if (session.code === "invalid_qr" || session.code === "table_disabled") {
        return { kind: "table_problem", problem: session.code };
      }
      const parsed = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/) }).safeParse(session.data);
      if (session.status !== 201 || !parsed.success) return { kind: "failed", keepAttempt: true };
      token = parsed.data.token;
      tokens.set(token);
    }

    reply = await post("/api/orders", { Authorization: `Bearer ${token}`, "Idempotency-Key": key }, { items: lines });
    if (!reply) return null;
    if (reply.status !== 401 || reply.code === "guest_session_revoked") return reply;
    tokens.clear();
  }
  return reply;
}

function isReply(result: Reply | SubmitOutcome): result is Reply {
  return "status" in result;
}

export async function submitCart({
  qrToken,
  lines,
  attempt,
  tokens,
}: {
  qrToken: string;
  lines: OrderLine[];
  attempt: SubmitAttempt;
  tokens: TokenStore;
}): Promise<SubmitOutcome> {
  // Freeze both payload and key until the outcome is known, even if the cart was edited.
  const result = await sendOrder(qrToken, attempt.lines, attempt.key, tokens);
  if (!result) return { kind: "failed", keepAttempt: true };
  if (!isReply(result)) return result;

  if (result.status === 200 || result.status === 201) {
    const order = orderSchema.safeParse(result.data);
    if (!order.success) return { kind: "failed", keepAttempt: true };
    const earlierAttempt = lines.length !== attempt.lines.length || lines.some((line) =>
      !attempt.lines.some((sent) => sent.menuItemId === line.menuItemId && sent.qty === line.qty));
    return { kind: "sent", order: order.data, sentLines: attempt.lines, earlierAttempt };
  }
  if (BLOCKING_CODES.includes(result.code)) return { kind: "blocked" };
  if (TAB_CLOSED_CODES.includes(result.code)) {
    tokens.clear();
    return { kind: "tab_closed" };
  }

  // Older saved attempts may have sent edited lines under this key. Try their
  // frozen payload once, but never discard the key on an inconclusive answer.
  if (result.code === "idempotency_key_mismatch") {
    const original = await sendOrder(qrToken, attempt.lines, attempt.key, tokens);
    if (!original) return { kind: "failed", keepAttempt: true };
    if (!isReply(original)) return original;
    if (original.status === 200 || original.status === 201) {
      const order = orderSchema.safeParse(original.data);
      if (!order.success) return { kind: "failed", keepAttempt: true };
      return { kind: "sent", order: order.data, sentLines: attempt.lines, earlierAttempt: true };
    }
    if (TAB_CLOSED_CODES.includes(original.code)) {
      tokens.clear();
      return { kind: "tab_closed" };
    }
    return { kind: "failed", keepAttempt: true };
  }

  return { kind: "failed", keepAttempt: true };
}
