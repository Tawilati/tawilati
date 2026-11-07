import { describe, expect, it } from "vitest";
import { dayBounds, isCalendarDate, previousDay, todayIn } from "@/utils/timezone";

describe("todayIn", () => {
  it("gives the date on the café's clock, not UTC's", () => {
    // 23:30 UTC on 3 Nov is already 01:30 on 4 Nov in Beirut (UTC+2 in winter).
    expect(todayIn("Asia/Beirut", new Date("2026-11-03T23:30:00Z"))).toBe("2026-11-04");
    expect(todayIn("UTC", new Date("2026-11-03T23:30:00Z"))).toBe("2026-11-03");
  });
});

describe("dayBounds", () => {
  it("runs from local midnight to the last millisecond before the next one", () => {
    expect(dayBounds("2026-11-04", "Asia/Beirut")).toEqual({
      start: new Date("2026-11-03T22:00:00.000Z"),
      end: new Date("2026-11-04T21:59:59.999Z"),
    });
  });

  it("follows summer time", () => {
    expect(dayBounds("2026-07-01", "Asia/Beirut").start).toEqual(new Date("2026-06-30T21:00:00.000Z"));
  });

  it("is 23 hours long on the night the clocks go forward", () => {
    // Lebanon jumps from 00:00 to 01:00 on Sunday 29 March 2026, so the day starts at 01:00 (UTC+2 → +3).
    const { start, end } = dayBounds("2026-03-29", "Asia/Beirut");
    expect(start).toEqual(new Date("2026-03-28T22:00:00.000Z"));
    expect(end).toEqual(new Date("2026-03-29T20:59:59.999Z"));
  });

  it("is the plain calendar day in UTC", () => {
    expect(dayBounds("2026-11-04", "UTC")).toEqual({
      start: new Date("2026-11-04T00:00:00.000Z"),
      end: new Date("2026-11-04T23:59:59.999Z"),
    });
  });
});

describe("previousDay", () => {
  it("steps back one calendar day, across months and years", () => {
    expect(previousDay("2026-11-04")).toBe("2026-11-03");
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
  });
});

describe("isCalendarDate", () => {
  it("accepts a real date and refuses one that doesn't exist", () => {
    expect(isCalendarDate("2026-11-04")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
  });
});
