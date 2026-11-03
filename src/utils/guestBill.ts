// What the guest's order status bar says. Pure logic, no React or fetching.
import type { GuestOrderResponse } from "@/types/Order";

type RoundStatus = GuestOrderResponse["status"];

// Most useful first: food waiting to be collected, then food on its way.
const PRIORITY: RoundStatus[] = ["READY", "PREPARING", "NEW", "SERVED", "CANCELLED"];

export function headlineStatus(orders: Pick<GuestOrderResponse, "status">[]): RoundStatus | null {
  return PRIORITY.find((status) => orders.some((order) => order.status === status)) ?? null;
}
