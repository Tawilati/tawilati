import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";

const repo = vi.hoisted(() => ({
  getBusiness: vi.fn(),
  getDailyPayments: vi.fn(),
  getDailyOrders: vi.fn(),
}));
vi.mock("@/repository/ReportRepo", () => ({ reportRepo: repo }));

import { reportService } from "@/service/ReportService";
import { HttpException } from "@/utils/exceptions/http/HttpException";

const BIZ = "biz-1";
const dec = (v: string) => new Prisma.Decimal(v);

function payment(method: "CASH" | "EXTERNAL_CARD", usd: string, lbp: string, waiter: [string, string]) {
  return { amountUSD: dec(usd), amountLBP: dec(lbp), method, recordedById: waiter[0], recordedBy: { id: waiter[0], name: waiter[1] } };
}

function line(id: string, name: string, qty: number, priceUSD: string) {
  return { menuItemId: id, qty, priceUSD: dec(priceUSD), rateSnapshot: dec("89500"), menuItem: { name } };
}

const SARA: [string, string] = ["u-sara", "Sara Haddad"];
const ALI: [string, string] = ["u-ali", "Ali Fares"];

beforeEach(() => {
  vi.clearAllMocks();
  repo.getBusiness.mockResolvedValue({ name: "Demo Café", timezone: "Asia/Beirut" });
  repo.getDailyPayments.mockResolvedValue([]);
  repo.getDailyOrders.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe("ReportService.getDailyReport", () => {
  it("reads the day on the café's clock: Beirut midnight to midnight", async () => {
    await reportService.getDailyReport(BIZ, "2026-11-04");

    const start = new Date("2026-11-03T22:00:00.000Z");
    const end = new Date("2026-11-04T21:59:59.999Z");
    expect(repo.getBusiness).toHaveBeenCalledWith(BIZ);
    expect(repo.getDailyPayments).toHaveBeenCalledWith(BIZ, start, end);
    expect(repo.getDailyOrders).toHaveBeenCalledWith(BIZ, start, end);
  });

  it("reports today on the café's clock when no date is given", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-03T23:30:00Z")); // 01:30 on 4 Nov in Beirut

    const report = await reportService.getDailyReport(BIZ);

    expect(report.date).toBe("2026-11-04");
    expect(repo.getDailyPayments).toHaveBeenCalledWith(BIZ, new Date("2026-11-03T22:00:00.000Z"), expect.any(Date));
  });

  it("adds up the bills, by payment method and by waiter", async () => {
    repo.getDailyPayments.mockResolvedValue([
      payment("CASH", "6.00", "537000", SARA),
      payment("EXTERNAL_CARD", "3.50", "313250", SARA),
      payment("CASH", "2.50", "223750", ALI),
    ]);

    const report = await reportService.getDailyReport(BIZ, "2026-11-04");

    expect(report).toMatchObject({
      date: "2026-11-04", businessName: "Demo Café", timezone: "Asia/Beirut",
      totalUSD: "12.00", totalLBP: "1074000.00", tablesServed: 3,
    });
    expect(report.byMethod).toEqual(expect.arrayContaining([
      { method: "CASH", count: 2, totalUSD: "8.50", totalLBP: "760750.00" },
      { method: "EXTERNAL_CARD", count: 1, totalUSD: "3.50", totalLBP: "313250.00" },
    ]));
    expect(report.byWaiter).toEqual(expect.arrayContaining([
      { waiterId: "u-sara", waiterName: "Sara Haddad", count: 2, totalUSD: "9.50", totalLBP: "850250.00" },
      { waiterId: "u-ali", waiterName: "Ali Fares", count: 1, totalUSD: "2.50", totalLBP: "223750.00" },
    ]));
  });

  it("counts rounds and items, and ranks the items by quantity", async () => {
    repo.getDailyOrders.mockResolvedValue([
      { orderLines: [line("esp", "Espresso", 2, "2.50"), line("cap", "Cappuccino", 1, "3.50")] },
      { orderLines: [line("cap", "Cappuccino", 3, "3.50")] },
    ]);

    const report = await reportService.getDailyReport(BIZ, "2026-11-04");

    expect(report.ordersCount).toBe(2);
    expect(report.itemsSold).toBe(6);
    expect(report.topItems).toEqual([
      { menuItemId: "cap", name: "Cappuccino", qty: 4, totalUSD: "14.00" },
      { menuItemId: "esp", name: "Espresso", qty: 2, totalUSD: "5.00" },
    ]);
  });

  it("keeps the ten best sellers", async () => {
    repo.getDailyOrders.mockResolvedValue([
      { orderLines: Array.from({ length: 12 }, (_, i) => line(`item-${i}`, `Item ${i}`, i + 1, "1.00")) },
    ]);

    const report = await reportService.getDailyReport(BIZ, "2026-11-04");

    expect(report.topItems).toHaveLength(10);
    expect(report.topItems[0]).toMatchObject({ menuItemId: "item-11", qty: 12 });
  });

  it("answers a quiet day with zeros", async () => {
    const report = await reportService.getDailyReport(BIZ, "2026-11-04");

    expect(report).toMatchObject({
      totalUSD: "0.00", totalLBP: "0.00", tablesServed: 0, ordersCount: 0, itemsSold: 0,
      byMethod: [], byWaiter: [], topItems: [],
    });
  });

  it("answers 404 not_found when the business doesn't exist", async () => {
    repo.getBusiness.mockResolvedValue(null);

    const error = await reportService.getDailyReport(BIZ, "2026-11-04").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect(error).toMatchObject({ status: 404, message: "not_found" });
    expect(repo.getDailyPayments).not.toHaveBeenCalled();
  });
});
