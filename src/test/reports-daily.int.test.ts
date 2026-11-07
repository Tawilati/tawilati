import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GET as dailyRoute } from "@/app/api/reports/daily/route";

// The owner's daily report on a real database. The route runs for real (guard, Zod, service, repository);
// only the identity headers the proxy normally sets are written by hand. Bills sit either side of midnight
// in Beirut, so the day has to follow the café's clock; business B proves one business never sees another's sales.
const run = randomBytes(4).toString("hex");
let businessA: { id: string };
let businessB: { id: string };
let ownerA: { id: string };
let ownerB: { id: string };

function daily(businessId: string, userId: string, date: string) {
  return dailyRoute(
    new NextRequest(`http://localhost/api/reports/daily?date=${date}`, {
      headers: { "x-user-id": userId, "x-user-role": "OWNER", "x-business-id": businessId },
    }),
  );
}

// A closed bill on its own table: its totals, how it was paid, and when.
async function closedBill(
  businessId: string,
  recordedById: string,
  bill: { usd: string; lbp: string },
  paid: { usd: string; lbp: string; method: "CASH" | "EXTERNAL_CARD" },
  at: string,
) {
  const table = await prisma.diningTable.create({
    data: { businessId, label: `T-${randomBytes(3).toString("hex")}`, slug: `t-${randomBytes(3).toString("hex")}`, qrToken: randomBytes(32).toString("hex") },
  });
  const tab = await prisma.tableSession.create({
    data: {
      businessId, tableId: table.id, status: "CLOSED", activeTableId: null, closedAt: new Date(at),
      totalUSD: bill.usd, totalLBP: bill.lbp, amountPaidUSD: paid.usd, amountPaidLBP: paid.lbp,
    },
  });
  await prisma.payment.create({
    data: { sessionId: tab.id, amountUSD: paid.usd, amountLBP: paid.lbp, method: paid.method, recordedById, createdAt: new Date(at) },
  });
}

beforeAll(async () => {
  const business = (name: string) => ({
    name: `Test Report ${name} ${run}`,
    slug: `test-report-${name.toLowerCase()}-${run}`,
    exchangeRate: "89500",
    timezone: "Asia/Beirut",
  });
  businessA = await prisma.business.create({ data: business("A") });
  businessB = await prisma.business.create({ data: business("B") });
  const owner = (businessId: string, name: string) =>
    prisma.user.create({
      data: { businessId, name, email: `report-${name}-${run}@example.test`, passwordHash: "x", role: "OWNER" },
    });
  ownerA = await owner(businessA.id, "a");
  ownerB = await owner(businessB.id, "b");

  // 12:00 in Beirut on 4 Nov: a $10 bill paid half in dollars, half in pounds.
  await closedBill(businessA.id, ownerA.id, { usd: "10.00", lbp: "895000" }, { usd: "5.00", lbp: "447500", method: "CASH" }, "2026-11-04T10:00:00Z");
  // 01:30 in Beirut on 4 Nov (still 3 Nov in UTC): belongs to 4 Nov.
  await closedBill(businessA.id, ownerA.id, { usd: "6.00", lbp: "537000" }, { usd: "6.00", lbp: "0", method: "EXTERNAL_CARD" }, "2026-11-03T23:30:00Z");
  // 00:30 in Beirut on 5 Nov (still 4 Nov in UTC): belongs to 5 Nov.
  await closedBill(businessA.id, ownerA.id, { usd: "8.00", lbp: "716000" }, { usd: "8.00", lbp: "0", method: "CASH" }, "2026-11-04T22:30:00Z");
  // Another business, same day.
  await closedBill(businessB.id, ownerB.id, { usd: "99.00", lbp: "8860500" }, { usd: "99.00", lbp: "0", method: "CASH" }, "2026-11-04T10:00:00Z");
});

afterAll(async () => {
  try {
    const ids = [businessA?.id, businessB?.id].filter((id): id is string => Boolean(id));
    // Payments point at the user who recorded them (RESTRICT), so they go before the business takes its users.
    await prisma.payment.deleteMany({ where: { session: { businessId: { in: ids } } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await prisma.$disconnect();
  }
});

describe("GET /api/reports/daily", () => {
  it("counts the bills closed between midnight and midnight in Beirut, at what they were worth", async () => {
    const response = await daily(businessA.id, ownerA.id, "2026-11-04");

    expect(response.status).toBe(200);
    const report = (await response.json()).data;
    expect(report).toMatchObject({
      date: "2026-11-04",
      timezone: "Asia/Beirut",
      totalUSD: "16.00",
      totalLBP: "1432000.00",
      receivedUSD: "11.00",
      receivedLBP: "447500.00",
      tablesServed: 2,
    });
    expect(report.byMethod).toEqual(expect.arrayContaining([
      { method: "CASH", count: 1, totalUSD: "10.00", totalLBP: "895000.00" },
      { method: "EXTERNAL_CARD", count: 1, totalUSD: "6.00", totalLBP: "537000.00" },
    ]));
  });

  it("puts a bill closed after midnight in Beirut on the next day", async () => {
    const report = (await (await daily(businessA.id, ownerA.id, "2026-11-05")).json()).data;

    expect(report).toMatchObject({ totalUSD: "8.00", tablesServed: 1 });
  });

  it("never counts another business's sales", async () => {
    const reportB = (await (await daily(businessB.id, ownerB.id, "2026-11-04")).json()).data;

    expect(reportB).toMatchObject({ totalUSD: "99.00", tablesServed: 1 });
    expect(reportB.byWaiter.map((w: { waiterId: string }) => w.waiterId)).toEqual([ownerB.id]);
  });
});
