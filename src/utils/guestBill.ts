// What the guest's order status bar says. Pure logic, no React or fetching.
import type { GuestOrderResponse } from "@/types/Order";

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
