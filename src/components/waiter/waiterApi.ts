// The waiter's screens talk to /api/waiter/* (open tabs, bill, served, close) and /api/tables (every table,
// so free ones show too). Error codes never reach the person: `waiterSentenceFor` turns each one into a sentence.
import { ApiError, call } from "@/components/dashboard/api";
import type { FloorTable, OpenTab } from "@/utils/waiterFloor";

export type RoundStatus = "NEW" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";

export type TabBill = {
  sessionId: string;
  tableLabel: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  orderCount: number;
  totalUSD: string;
  totalLBP: string;
  amountPaidUSD: string;
  amountPaidLBP: string;
  orders: {
    orderId: string;
    status: RoundStatus;
    totalUSD: string;
    totalLBP: string;
    createdAt: string;
    lines: { menuItemId: string; name: string; qty: number; priceUSD: string; priceLBP: string }[];
  }[];
};

export type PaymentMethod = "CASH" | "EXTERNAL_CARD";

export type CloseReceipt = {
  sessionId: string;
  status: "CLOSED";
  totalUSD: string;
  totalLBP: string;
  amountReceivedUSD: string;
  amountReceivedLBP: string;
  changeUSD: string;
  changeLBP: string;
  paymentId: string | null;
};

export const waiterApi = {
  tabs: () => call<OpenTab[]>("/api/waiter/tabels", "GET"),
  tables: () => call<FloorTable[]>("/api/tables", "GET"),
  bill: (sessionId: string) => call<TabBill>(`/api/waiter/order/${sessionId}/bill`, "GET"),
  serve: (orderId: string) => call<{ orderId: string; status: RoundStatus }>(`/api/waiter/order/${orderId}/served`, "PATCH"),
  // Amounts go as JSON numbers, the shape the close route accepts today.
  close: (sessionId: string, body: { amountReceivedUSD: number; amountReceivedLBP: number; method: PaymentMethod }) =>
    call<CloseReceipt>(`/api/waiter/order/${sessionId}/close`, "POST", body),
};

const SENTENCES: Record<string, string> = {
  offline: "We couldn't reach Tawilati. Check your connection and try again.",
  unauthorized: "Your session ended. Sign in again.",
  // Another tab signed this browser in with another role.
  forbidden: "This browser is signed in with another account. Sign in again as the waiter.",
  not_found: "This table's bill is no longer there. The list will refresh.",
  invalid_transition: "This round has already been served or isn't ready yet.",
  table_session_closed: "This table was already closed and paid.",
  tab_not_settleable: "Serve every round before closing the bill.",
  insufficient_payment: "USD and LBP received together are less than the bill.",
  validation_error: "Check the amounts: they must be numbers of 0 or more.",
};

export function waiterSentenceFor(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  return SENTENCES[code] ?? "Something went wrong on our side. Please try again in a moment.";
}
