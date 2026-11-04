import { describe, expect, it } from "vitest";
import { closedBill, headlineStatus, otherPhonesUSD, unevenShare } from "@/utils/guestBill";

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

describe("unevenShare", () => {
  it("has nothing to add when the bill divides evenly", () => {
    expect(unevenShare("6.00", "1.50", 4)).toBeNull();
  });

  it("names who pays a cent less when the rounded share overshoots the total", () => {
    // $5.00 / 3 = 1.67 each, but 3 × 1.67 = 5.01.
    expect(unevenShare("5.00", "1.67", 3)).toEqual({ count: 1, amountUSD: "1.66" });
  });

  it("names who pays a cent more when the rounded share falls short", () => {
    // $5.00 / 6 = 0.83 each, but 6 × 0.83 = 4.98.
    expect(unevenShare("5.00", "0.83", 6)).toEqual({ count: 2, amountUSD: "0.84" });
  });

  it("keeps the shares adding up to the total", () => {
    const total = 1001; // cents
    for (let people = 2; people <= 50; people++) {
      const per = Math.round(total / people); // half up, as the API rounds
      const per$ = `${Math.floor(per / 100)}.${String(per % 100).padStart(2, "0")}`;
      const odd = unevenShare("10.01", per$, people);
      const oddCents = odd ? Number(odd.amountUSD.replace(".", "")) : 0;
      const oddCount = odd?.count ?? 0;
      expect(per * (people - oddCount) + oddCents * oddCount).toBe(total);
    }
  });
});

describe("otherPhonesUSD", () => {
  it("is the table total minus what this phone ordered", () => {
    expect(otherPhonesUSD("6.00", "3.50")).toBe("2.50");
  });

  it("is zero when this phone ordered everything", () => {
    expect(otherPhonesUSD("12.30", "12.30")).toBe("0.00");
  });

  it("handles large amounts without float drift", () => {
    expect(otherPhonesUSD("1234567.89", "0.10")).toBe("1234567.79");
  });
});
