import { describe, expect, it } from "vitest";
import { barWidth, countChange, dayLabel, moneyChange } from "@/utils/dailyReport";
import { nextDay } from "@/utils/timezone";

describe("moneyChange", () => {
  it("is up by the difference when the day took more", () => {
    expect(moneyChange("486.50", "320.00")).toEqual({ direction: "up", amountUSD: "166.50" });
  });

  it("is down by the difference when the day took less", () => {
    expect(moneyChange("12.00", "12.10")).toEqual({ direction: "down", amountUSD: "0.10" });
  });

  it("is the same when nothing changed", () => {
    expect(moneyChange("0.00", "0.00")).toEqual({ direction: "same", amountUSD: "0.00" });
  });
});

describe("countChange", () => {
  it("compares two counts", () => {
    expect(countChange(38, 29)).toEqual({ direction: "up", amount: 9 });
    expect(countChange(139, 142)).toEqual({ direction: "down", amount: 3 });
    expect(countChange(4, 4)).toEqual({ direction: "same", amount: 0 });
  });
});

describe("dayLabel", () => {
  it("names the day the same way wherever the browser is", () => {
    expect(dayLabel("2026-11-04")).toBe("Wed 4 Nov 2026");
    expect(dayLabel("2026-11-03", { year: false })).toBe("Tue 3 Nov");
  });
});

describe("barWidth", () => {
  it("sizes each bar against the biggest one", () => {
    expect(barWidth(34, 34)).toBe(100);
    expect(barWidth(17, 34)).toBe(50);
  });

  it("keeps a sliver visible for a tiny value and nothing for zero", () => {
    expect(barWidth(1, 1000)).toBe(2);
    expect(barWidth(0, 10)).toBe(0);
    expect(barWidth(0, 0)).toBe(0);
  });
});

describe("nextDay", () => {
  it("steps forward one calendar day, across months and years", () => {
    expect(nextDay("2026-11-04")).toBe("2026-11-05");
    expect(nextDay("2026-02-28")).toBe("2026-03-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });
});
