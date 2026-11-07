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

const billSchema = z.object({
  sessionId: z.string().min(1), tableLabel: z.string().min(1),
  status: z.enum(["OPEN", "CLOSED"]),
  totalUSD: amount, totalLBP: amount,
  guestTotalUSD: amount, guestTotalLBP: amount,
  billRequestedAt: z.string().nullable(),
  orders: z.array(z.object({
    orderId: z.string().min(1),
    status: orderSchema.shape.status,
    totalUSD: amount, totalLBP: amount,
    createdAt: z.string().min(1),
    lines: orderSchema.shape.lines,
  })),
});

export type GuestBill = z.infer<typeof billSchema>;

export type BillResult =
  | { kind: "bill"; bill: GuestBill }
  | { kind: "expired" }
  | { kind: "closed" }
  | { kind: "unavailable" };

async function readBill(token: string): Promise<BillResult | { kind: "token_expired" }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("/api/orders/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (res.status === 401) {
      if (json?.message === "token_expired") return { kind: "token_expired" };
      return { kind: json?.message === "guest_session_revoked" ? "closed" : "expired" };
    }
    const bill = billSchema.safeParse(json?.data);
    return res.ok && bill.success ? { kind: "bill", bill: bill.data } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

// An expired token is renewed, never replaced: a new guest session would lose this phone's
// rounds, and on a table whose bill was closed it would start a new, empty tab.
export async function fetchGuestBill(token: string): Promise<BillResult> {
  const first = await readBill(token);
  if (first.kind !== "token_expired") return first;

  const renewal = await renewToken(token);
  if (renewal === "closed") return { kind: "closed" };
  if (renewal === "unknown") return { kind: "expired" };
  if (renewal === "unavailable") return { kind: "unavailable" };

  const second = await readBill(token);
  return second.kind === "token_expired" ? { kind: "expired" } : second;
}

export type AskBillResult = { kind: "asked" } | { kind: "closed" } | { kind: "expired" } | { kind: "unavailable" };

// "Ask for the bill": the waiter's tile for this table turns yellow. Asking again is harmless (the server keeps
// the first time). An expired token is renewed and the request sent once more, as for the bill.
export async function askForBill(token: string): Promise<AskBillResult> {
  for (let tries = 0; tries < 2; tries++) {
    const reply = await post("/api/orders/me/bill-request", { Authorization: `Bearer ${token}` }, undefined);
    if (!reply) return { kind: "unavailable" };
    if (reply.status === 200) return { kind: "asked" };
    if (TAB_CLOSED_CODES.includes(reply.code)) return { kind: "closed" };
    if (reply.code !== "token_expired" || tries > 0) return reply.status === 401 ? { kind: "expired" } : { kind: "unavailable" };

    const renewal = await renewToken(token);
    if (renewal === "closed") return { kind: "closed" };
    if (renewal === "unknown") return { kind: "expired" };
    if (renewal === "unavailable") return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}

export type CancelResult = { kind: "cancelled" } | { kind: "started" } | { kind: "closed" } | { kind: "expired" } | { kind: "unavailable" };

// "Cancel order" on a round the kitchen hasn't started. A second tap finds it already cancelled, which is what the
// guest wanted; if the kitchen started it first, the round stays. An expired token is renewed and the request sent
// once more, as for the bill.
export async function cancelRound(token: string, orderId: string): Promise<CancelResult> {
  for (let tries = 0; tries < 2; tries++) {
    const reply = await post(`/api/orders/${orderId}/cancel`, { Authorization: `Bearer ${token}` }, undefined);
    if (!reply) return { kind: "unavailable" };
    if (reply.status === 200 || reply.code === "order_already_cancelled") return { kind: "cancelled" };
    if (reply.code === "cannot_cancel_order_already_in_progress") return { kind: "started" };
    if (TAB_CLOSED_CODES.includes(reply.code)) return { kind: "closed" };
    if (reply.code !== "token_expired" || tries > 0) return reply.status === 401 ? { kind: "expired" } : { kind: "unavailable" };

    const renewal = await renewToken(token);
    if (renewal === "closed") return { kind: "closed" };
    if (renewal === "unknown") return { kind: "expired" };
    if (renewal === "unavailable") return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}

const splitSchema = z.object({
  totalUSD: amount, totalLBP: amount,
  splitCount: z.number().int().min(1).max(50),
  perPersonUSD: amount, perPersonLBP: amount,
});

export type BillSplit = z.infer<typeof splitSchema>;
export type SplitResult = { kind: "split"; split: BillSplit } | { kind: "closed" } | { kind: "expired" } | { kind: "unavailable" };

// "Split equally": the table's total shared by the number of people paying. Nothing is saved.
// An expired token is renewed and the request sent once more, as for the bill.
export async function fetchSplit(token: string, people: number): Promise<SplitResult> {
  for (let tries = 0; tries < 2; tries++) {
    const reply = await post("/api/orders/split", { Authorization: `Bearer ${token}` }, { splitCount: people });
    if (!reply) return { kind: "unavailable" };
    if (reply.status === 200) {
      const split = splitSchema.safeParse(reply.data);
      return split.success ? { kind: "split", split: split.data } : { kind: "unavailable" };
    }
    if (TAB_CLOSED_CODES.includes(reply.code)) return { kind: "closed" };
    if (reply.code !== "token_expired" || tries > 0) return reply.status === 401 ? { kind: "expired" } : { kind: "unavailable" };

    const renewal = await renewToken(token);
    if (renewal === "closed") return { kind: "closed" };
    if (renewal === "unknown") return { kind: "expired" };
    if (renewal === "unavailable") return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}

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

async function renewToken(token: string): Promise<"renewed" | "closed" | "unknown" | "unavailable"> {
  const reply = await post("/api/guest-sessions/renew", { Authorization: `Bearer ${token}` }, undefined);
  if (!reply) return "unavailable";
  if (reply.status === 200) return "renewed";
  if (TAB_CLOSED_CODES.includes(reply.code)) return "closed";
  return reply.status === 401 ? "unknown" : "unavailable";
}

// Sends the order with this phone's token. An expired token is renewed, keeping this phone's rounds;
// one the server doesn't know is replaced. The idempotency key stays the same, so it still can't
// make a second ticket.
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
    if (reply.code === "token_expired") {
      const renewal = await renewToken(token);
      if (renewal === "unavailable") return null;
      if (renewal === "renewed") continue;
      if (renewal === "closed") {
        tokens.clear();
        return { kind: "tab_closed" };
      }
    }
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
