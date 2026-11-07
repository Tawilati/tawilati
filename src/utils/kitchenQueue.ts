// The kitchen screen's queue: every round still to cook, oldest first, as GET /api/kitchen/orders sends it
// (NEW and PREPARING, plus rounds the guest cancelled in the last minute, shown crossed out). Pure, so the
// counting and the overdue rule are tested without a browser.

// A ticket waiting this long since the guest sent it is overdue.
export const OVERDUE_MS = 10 * 60_000;

export type KitchenStatus = "NEW" | "PREPARING";

export type KitchenTicket = {
  orderId: string;
  tableLabel: string;
  sessionStatus: "OPEN" | "CLOSED";
  status: KitchenStatus | "CANCELLED";
  createdAt: string;
  cancelledAt: string | null;
  lines: { menuItemId: string; name: string; qty: number }[];
};

export function isOverdue(ticket: Pick<KitchenTicket, "createdAt" | "status">, now: number): boolean {
  return ticket.status !== "CANCELLED" && now - new Date(ticket.createdAt).getTime() >= OVERDUE_MS;
}

// Cancelled tickets are on screen for a minute but not part of the work: they don't count anywhere.
export function kitchenSummary(all: KitchenTicket[], now: number) {
  const tickets = all.filter((ticket) => ticket.status !== "CANCELLED");
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

// Rounds that turned cancelled since the previous read, for the "Table T1 cancelled an order" notice. Nothing on
// the first read: those were cancelled before the screen opened.
export function newlyCancelled(previous: KitchenTicket[] | null, next: KitchenTicket[]): KitchenTicket[] {
  if (!previous) return [];
  const already = new Set(previous.filter((ticket) => ticket.status === "CANCELLED").map((ticket) => ticket.orderId));
  return next.filter((ticket) => ticket.status === "CANCELLED" && !already.has(ticket.orderId));
}
