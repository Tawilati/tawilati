// Sends the guest's cart to the kitchen: POST /api/guest-sessions when this phone has no token yet,
// then POST /api/orders. Error codes stop here; the screen only sees what happened.
import type { OrderResponse } from "@/types/Order";
import type { OrderLine } from "@/utils/guestCart";

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
  | { kind: "failed"; keepAttempt: boolean };

type Reply = { status: number; code: string; data: unknown };

const BLOCKING_CODES = ["menu_item_sold_out", "menu_item_archived", "menu_item_not_found"];
const TAB_CLOSED_CODES = ["guest_session_revoked", "table_session_closed"];

// null when the server couldn't be reached.
async function post(url: string, headers: Record<string, string>, body: unknown): Promise<Reply | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, code: json?.message ?? "", data: json?.data };
  } catch {
    return null;
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
      token = (session.data as { token?: string } | undefined)?.token ?? null;
      if (!token) return { kind: "failed", keepAttempt: true };
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
  const result = await sendOrder(qrToken, lines, attempt.key, tokens);
  if (!result) return { kind: "failed", keepAttempt: true };
  if (!isReply(result)) return result;

  if (result.status === 200 || result.status === 201) {
    return { kind: "sent", order: result.data as PlacedOrder, sentLines: lines, earlierAttempt: false };
  }
  if (BLOCKING_CODES.includes(result.code)) return { kind: "blocked" };
  if (TAB_CLOSED_CODES.includes(result.code)) {
    tokens.clear();
    return { kind: "tab_closed" };
  }

  // The guest edited the cart after a submit whose answer got lost, and the key says that submit did
  // arrive. Asking again with its own lines returns the original order and creates nothing.
  if (result.code === "idempotency_key_mismatch") {
    const original = await sendOrder(qrToken, attempt.lines, attempt.key, tokens);
    if (!original) return { kind: "failed", keepAttempt: true };
    if (!isReply(original)) return original;
    if (original.status === 200 || original.status === 201) {
      return { kind: "sent", order: original.data as PlacedOrder, sentLines: attempt.lines, earlierAttempt: true };
    }
    return { kind: "failed", keepAttempt: false };
  }

  return { kind: "failed", keepAttempt: true };
}
