// What the guest's order status bar says. Pure logic, no React or fetching.
import type { GuestOrderResponse } from "@/types/Order";
import { fromCents, toCents } from "@/utils/money";

type RoundStatus = GuestOrderResponse["status"];

// Most useful first: food waiting to be collected, then food on its way.
const PRIORITY: RoundStatus[] = ["READY", "PREPARING", "NEW", "SERVED", "CANCELLED"];

export function headlineStatus(orders: Pick<GuestOrderResponse, "status">[]): RoundStatus | null {
  return PRIORITY.find((status) => orders.some((order) => order.status === status)) ?? null;
}

// Closing the bill ends this phone's session, so its last answer may predate the waiter's last "Mark served".
// The server only closes a bill once every round is served, so every phone can show the same thing.
export function closedBill<T extends { status: string; orders: Pick<GuestOrderResponse, "status">[] }>(bill: T): T {
  return {
    ...bill,
    status: "CLOSED",
    orders: bill.orders.map((order) => (order.status === "CANCELLED" ? order : { ...order, status: "SERVED" })),
  };
}

// The split API rounds each share to the cent, so the shares can miss the total by a few cents
// ($5.00 for 3 is $1.67 each, $5.01 in all). Says who pays a cent less (or more) so they add up.
export function unevenShare(totalUSD: string, perPersonUSD: string, people: number): { count: number; amountUSD: string } | null {
  const per = toCents(perPersonUSD);
  const over = per * people - toCents(totalUSD);
  if (over === 0) return null;
  return { count: Math.abs(over), amountUSD: fromCents(per - Math.sign(over)) };
}

// "Pay for my orders": what the other phones at the table ordered.
export function otherPhonesUSD(totalUSD: string, guestTotalUSD: string): string {
  return fromCents(Math.max(0, toCents(totalUSD) - toCents(guestTotalUSD)));
}
