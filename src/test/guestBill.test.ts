import { describe, expect, it } from "vitest";
import { closedBill, headlineStatus } from "@/utils/guestBill";

const rounds = (...statuses: string[]) => statuses.map((status) => ({ status })) as Parameters<typeof headlineStatus>[0];

describe("headlineStatus", () => {
  it("has nothing to show before this phone has a round", () => {
    expect(headlineStatus([])).toBeNull();
  });

  it("shows Ready ahead of every other status, wherever that round sits", () => {
    expect(headlineStatus(rounds("NEW", "PREPARING", "READY", "SERVED"))).toBe("READY");
  });

  it("shows Preparing ahead of New", () => {
    expect(headlineStatus(rounds("NEW", "PREPARING"))).toBe("PREPARING");
  });

  it("shows New ahead of a round already served", () => {
    expect(headlineStatus(rounds("SERVED", "NEW"))).toBe("NEW");
  });

  it("shows Served ahead of a cancelled round", () => {
    expect(headlineStatus(rounds("CANCELLED", "SERVED"))).toBe("SERVED");
  });

  it("shows Cancelled when nothing else is left", () => {
    expect(headlineStatus(rounds("CANCELLED"))).toBe("CANCELLED");
  });
});

describe("closedBill", () => {
  const bill = {
    status: "OPEN" as const,
    orders: [
      { orderId: "a", status: "READY" as const },
      { orderId: "b", status: "SERVED" as const },
      { orderId: "c", status: "CANCELLED" as const },
    ],
  };

  it("marks the bill closed and every round served, as the server only closes a bill once they all are", () => {
    expect(closedBill(bill)).toEqual({
      status: "CLOSED",
      orders: [
        { orderId: "a", status: "SERVED" },
        { orderId: "b", status: "SERVED" },
        { orderId: "c", status: "CANCELLED" },
      ],
    });
  });

  it("leaves the last answer it was given untouched", () => {
    closedBill(bill);
    expect(bill.status).toBe("OPEN");
    expect(bill.orders[0].status).toBe("READY");
  });
});
