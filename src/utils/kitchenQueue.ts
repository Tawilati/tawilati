// The kitchen screen's queue: every round still to cook, oldest first, as GET /api/kitchen/orders sends it
// (NEW and PREPARING only). Pure, so the counting and the overdue rule are tested without a browser.

// A ticket waiting this long since the guest sent it is overdue.
export const OVERDUE_MS = 10 * 60_000;

export type KitchenStatus = "NEW" | "PREPARING";

export type KitchenTicket = {
  orderId: string;
  tableLabel: string;
  sessionStatus: "OPEN" | "CLOSED";
  status: KitchenStatus;
  createdAt: string;
  lines: { menuItemId: string; name: string; qty: number }[];
};

export function isOverdue(ticket: Pick<KitchenTicket, "createdAt">, now: number): boolean {
  return now - new Date(ticket.createdAt).getTime() >= OVERDUE_MS;
}

export function kitchenSummary(tickets: KitchenTicket[], now: number) {
  return {
    active: tickets.length,
    fresh: tickets.filter((ticket) => ticket.status === "NEW").length,
    preparing: tickets.filter((ticket) => ticket.status === "PREPARING").length,
    overdue: tickets.filter((ticket) => isOverdue(ticket, now)).length,
  };
}

// What the screen shows right after a tap, before the next refresh: a started ticket stays where it is,
// a ready one leaves the queue. The others never move.
export function applyStatus(tickets: KitchenTicket[], orderId: string, status: KitchenStatus | "READY"): KitchenTicket[] {
  if (status === "READY") return tickets.filter((ticket) => ticket.orderId !== orderId);
  return tickets.map((ticket) => (ticket.orderId === orderId ? { ...ticket, status } : ticket));
}
