import { describe, expect, it } from "vitest";
import { applyStatus, isOverdue, kitchenSummary, newlyCancelled, OVERDUE_MS, type KitchenTicket } from "@/utils/kitchenQueue";

const NOW = new Date("2026-11-03T13:00:00.000Z").getTime();
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

function ticket(orderId: string, status: KitchenTicket["status"], minutes: number): KitchenTicket {
  return {
    orderId,
    tableLabel: "T1",
    sessionStatus: "OPEN",
    status,
    createdAt: minutesAgo(minutes),
    cancelledAt: status === "CANCELLED" ? minutesAgo(0) : null,
    lines: [{ menuItemId: "esp", name: "Espresso", qty: 1 }],
  };
}

describe("isOverdue", () => {
  it("is overdue from 10 minutes after the round was sent", () => {
    expect(OVERDUE_MS).toBe(10 * 60_000);
    expect(isOverdue(ticket("a", "NEW", 9.9), NOW)).toBe(false);
    expect(isOverdue(ticket("a", "NEW", 10), NOW)).toBe(true);
    expect(isOverdue(ticket("a", "PREPARING", 25), NOW)).toBe(true);
  });
});

describe("kitchenSummary", () => {
  it("counts active, new, preparing and overdue tickets", () => {
    const tickets = [ticket("a", "NEW", 12), ticket("b", "PREPARING", 11), ticket("c", "PREPARING", 3), ticket("d", "NEW", 0)];

    expect(kitchenSummary(tickets, NOW)).toEqual({ active: 4, fresh: 2, preparing: 2, overdue: 2 });
  });

  it("is all zero for an empty kitchen", () => {
    expect(kitchenSummary([], NOW)).toEqual({ active: 0, fresh: 0, preparing: 0, overdue: 0 });
  });
});

describe("applyStatus", () => {
  const queue = [ticket("a", "NEW", 5), ticket("b", "NEW", 3), ticket("c", "PREPARING", 1)];

  it("keeps a started ticket in its place", () => {
    expect(applyStatus(queue, "b", "PREPARING").map((t) => [t.orderId, t.status])).toEqual([
      ["a", "NEW"],
      ["b", "PREPARING"],
      ["c", "PREPARING"],
    ]);
  });

  it("takes a ready ticket off the queue without moving the others", () => {
    expect(applyStatus(queue, "a", "READY").map((t) => t.orderId)).toEqual(["b", "c"]);
  });

  it("leaves the queue alone for an unknown ticket", () => {
    expect(applyStatus(queue, "zzz", "READY")).toEqual(queue);
  });
});

describe("cancelled tickets", () => {
  it("are never overdue and never counted", () => {
    const tickets = [ticket("a", "NEW", 1), ticket("b", "CANCELLED", 30)];
    expect(isOverdue(tickets[1], NOW)).toBe(false);
    expect(kitchenSummary(tickets, NOW)).toEqual({ active: 1, fresh: 1, preparing: 0, overdue: 0 });
  });

  it("newlyCancelled finds rounds cancelled since the last read", () => {
    const before = [ticket("a", "NEW", 1), ticket("b", "NEW", 2), ticket("c", "CANCELLED", 3)];
    const after = [ticket("a", "CANCELLED", 1), ticket("b", "NEW", 2), ticket("c", "CANCELLED", 3), ticket("d", "CANCELLED", 0)];
    expect(newlyCancelled(before, after).map((t) => t.orderId)).toEqual(["a", "d"]);
  });

  it("newlyCancelled says nothing on the first read, when the screen just opened", () => {
    expect(newlyCancelled(null, [ticket("a", "CANCELLED", 1)])).toEqual([]);
  });
});
