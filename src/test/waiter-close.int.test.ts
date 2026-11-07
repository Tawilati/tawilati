import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GET as billRoute } from "@/app/api/waiter/order/[id]/bill/route";
import { POST as closeRoute } from "@/app/api/waiter/order/[id]/close/route";
import { PATCH as servedRoute } from "@/app/api/waiter/order/[id]/served/route";
import { GET as tablesRoute } from "@/app/api/waiter/tabels/route";
import { POST as billRequestRoute } from "@/app/api/orders/me/bill-request/route";
import { POST as submitOrderRoute } from "@/app/api/orders/route";
import type { OrderStatus } from "@/app/generated/prisma/client";

// The waiter's end of the flow on a real database: serve a round, read the bill, close the tab.
// The routes run for real (guard, Zod, service, repository, database); only the identity headers the proxy
// normally sets are written by hand. Business B proves one business can't read or close another's tab.
const run = randomBytes(4).toString("hex");
let businessA: { id: string };
let businessB: { id: string };
let waiterA: { id: string };
let waiterB: { id: string };
let tableA: { id: string };
let espresso: { id: string };

type Who = { businessId: () => string; userId: () => string };
const asA: Who = { businessId: () => businessA.id, userId: () => waiterA.id };
const asB: Who = { businessId: () => businessB.id, userId: () => waiterB.id };

function request(who: Who, method: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = {
    "x-user-id": who.userId(),
    "x-user-role": "WAITER",
    "x-business-id": who.businessId(),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return new NextRequest("http://localhost/api/waiter", {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const cash = { amountReceivedUSD: 20, amountReceivedLBP: 0, method: "CASH" };

const bill = (who: Who, tabId: string) => billRoute(request(who, "GET"), params(tabId));
const close = (who: Who, tabId: string) => closeRoute(request(who, "POST", cash), params(tabId));
const serve = (who: Who, orderId: string) => servedRoute(request(who, "PATCH"), params(orderId));

// An open tab on table A, with one guest session and a 2 × espresso round in each given status.
async function openTab(statuses: OrderStatus[]) {
  const roundUSD = 5;
  const tab = await prisma.tableSession.create({
    data: {
      businessId: businessA.id,
      tableId: tableA.id,
      activeTableId: tableA.id,
      totalUSD: roundUSD * statuses.length,
      totalLBP: roundUSD * 89500 * statuses.length,
    },
  });
  const guest = await prisma.guestSession.create({
    data: {
      sessionId: tab.id,
      token: randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });
  const orders = [];
  for (const status of statuses) {
    orders.push(await prisma.diningOrder.create({
      data: {
        businessId: businessA.id,
        sessionId: tab.id,
        tableId: tableA.id,
        guestSessionId: guest.id,
        status,
        totalUSD: roundUSD,
        totalLBP: roundUSD * 89500,
        orderLines: {
          create: [{ menuItemId: espresso.id, qty: 2, priceUSD: "2.50", priceLBP: "223750", rateSnapshot: "89500" }],
        },
      },
    }));
  }
  return { tab, guest, orders };
}

beforeAll(async () => {
  const business = (name: string) => ({
    name: `Test Waiter ${name} ${run}`,
    slug: `test-waiter-${name.toLowerCase()}-${run}`,
    exchangeRate: "89500",
    timezone: "Asia/Beirut",
  });
  businessA = await prisma.business.create({ data: business("A") });
  businessB = await prisma.business.create({ data: business("B") });
  const waiter = (businessId: string, name: string) =>
    prisma.user.create({
      data: { businessId, name, email: `waiter-${name}-${run}@example.test`, passwordHash: "x", role: "WAITER" },
    });
  waiterA = await waiter(businessA.id, "a");
  waiterB = await waiter(businessB.id, "b");
  tableA = await prisma.diningTable.create({
    data: { businessId: businessA.id, label: "T1", slug: "t1", qrToken: randomBytes(32).toString("hex") },
  });
  const category = await prisma.menuCategory.create({ data: { businessId: businessA.id, name: "Coffee" } });
  espresso = await prisma.menuItem.create({
    data: { businessId: businessA.id, categoryId: category.id, name: "Espresso", priceUSD: "2.50", priceLBP: "223750" },
  });
});

// One open tab per table (activeTableId is unique), so each test starts with the table free.
beforeEach(async () => {
  await prisma.tableSession.updateMany({
    where: { tableId: tableA.id, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date(), activeTableId: null },
  });
});

afterAll(async () => {
  try {
    const ids = [businessA?.id, businessB?.id].filter((id): id is string => Boolean(id));
    // Payments point at the waiter who recorded them, and order lines at the menu item (both RESTRICT),
    // so they go before the business takes users and items with it.
    await prisma.payment.deleteMany({ where: { session: { businessId: { in: ids } } } });
    await prisma.diningOrder.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await prisma.$disconnect();
  }
});

describe("PATCH /api/waiter/order/:id/served", () => {
  it("serves a READY round once; a second tap is 400 invalid_transition", async () => {
    const { orders } = await openTab(["READY"]);

    const first = await serve(asA, orders[0].id);
    expect(first.status).toBe(200);
    expect((await first.json()).data).toEqual({ orderId: orders[0].id, status: "SERVED" });

    const second = await serve(asA, orders[0].id);
    expect(second.status).toBe(400);
    expect((await second.json()).message).toBe("invalid_transition");
  });

  it("answers 404 not_found to another business and leaves the round READY", async () => {
    const { orders } = await openTab(["READY"]);

    const response = await serve(asB, orders[0].id);

    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe("not_found");
    expect((await prisma.diningOrder.findUniqueOrThrow({ where: { id: orders[0].id } })).status).toBe("READY");
  });
});

describe("GET /api/waiter/order/:id/bill", () => {
  it("lists cancelled rounds too, but only the others add up to the totals", async () => {
    const { tab, orders } = await openTab(["SERVED", "PREPARING"]);
    // A cancelled round isn't part of the tab's totals; the sheet shows it greyed.
    await prisma.diningOrder.update({ where: { id: orders[1].id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await prisma.tableSession.update({ where: { id: tab.id }, data: { totalUSD: 5, totalLBP: 447500 } });
    await prisma.diningOrder.create({
      data: {
        businessId: businessA.id, sessionId: tab.id, tableId: tableA.id, status: "NEW",
        totalUSD: 0, totalLBP: 0,
      },
    });

    const response = await bill(asA, tab.id);

    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data.orders.map((o: { status: string }) => o.status)).toEqual(["SERVED", "CANCELLED", "NEW"]);
    expect(data.orderCount).toBe(2);
    const linesUSD = data.orders
      .filter((o: { status: string }) => o.status !== "CANCELLED")
      .flatMap((o: { lines: { qty: number; priceUSD: string }[] }) => o.lines)
      .reduce((sum: number, l: { qty: number; priceUSD: string }) => sum + l.qty * Number(l.priceUSD), 0);
    expect(linesUSD.toFixed(2)).toBe(data.totalUSD);
  });

  it("answers 404 not_found to another business", async () => {
    const { tab } = await openTab(["SERVED"]);

    const response = await bill(asB, tab.id);

    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe("not_found");
  });
});

describe("POST /api/waiter/order/:id/close", () => {
  it("refuses with 409 tab_not_settleable while a round isn't served, and changes nothing", async () => {
    const { tab, guest } = await openTab(["SERVED", "PREPARING"]);

    const response = await close(asA, tab.id);

    expect(response.status).toBe(409);
    expect((await response.json()).message).toBe("tab_not_settleable");
    const after = await prisma.tableSession.findUniqueOrThrow({ where: { id: tab.id } });
    expect([after.status, after.activeTableId]).toEqual(["OPEN", tableA.id]);
    expect(await prisma.payment.count({ where: { sessionId: tab.id } })).toBe(0);
    expect((await prisma.guestSession.findUniqueOrThrow({ where: { id: guest.id } })).revokedAt).toBeNull();
  });

  it("closes once when two closes race: one 200, one 409, a single payment", async () => {
    const { tab, guest } = await openTab(["SERVED", "SERVED"]);

    const responses = await Promise.all([close(asA, tab.id), close(asA, tab.id)]);

    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const loser = responses.find((r) => r.status === 409)!;
    expect((await loser.json()).message).toBe("table_session_closed");
    const winner = (await responses.find((r) => r.status === 200)!.json()).data;
    expect(winner).toMatchObject({ status: "CLOSED", totalUSD: "10.00", amountPaidUSD: "10.00", changeUSD: "10.00" });

    const payments = await prisma.payment.findMany({ where: { sessionId: tab.id } });
    expect(payments).toHaveLength(1);
    expect([payments[0].id, payments[0].recordedById, payments[0].amountUSD.toFixed(2)])
      .toEqual([winner.paymentId, waiterA.id, "10.00"]);
    const after = await prisma.tableSession.findUniqueOrThrow({ where: { id: tab.id } });
    expect([after.status, after.activeTableId, after.amountPaidUSD.toFixed(2)]).toEqual(["CLOSED", null, "10.00"]);
    expect((await prisma.guestSession.findUniqueOrThrow({ where: { id: guest.id } })).revokedAt).not.toBeNull();
  });

  it("closes an empty tab without a payment", async () => {
    const { tab } = await openTab([]);

    const response = await closeRoute(
      request(asA, "POST", { amountReceivedUSD: 0, amountReceivedLBP: 0, method: "CASH" }),
      params(tab.id),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ status: "CLOSED", paymentId: null });
    expect(await prisma.payment.count({ where: { sessionId: tab.id } })).toBe(0);
  });

  it("answers 404 not_found to another business and leaves the tab open", async () => {
    const { tab } = await openTab(["SERVED"]);

    const response = await close(asB, tab.id);

    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe("not_found");
    expect((await prisma.tableSession.findUniqueOrThrow({ where: { id: tab.id } })).status).toBe("OPEN");
  });
});

describe("Ask for the bill (guest) and the waiter's tables list", () => {
  const guestRequest = (token: string, path: string, body?: unknown, key?: string) =>
    new NextRequest(`http://localhost${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const tabs = async (who: Who) => {
    const response = await tablesRoute(request(who, "GET"));
    expect(response.status).toBe(200);
    return (await response.json()).data as {
      sessionId: string; tableId: string; lastOrderAt: string | null; billRequestedAt: string | null;
    }[];
  };

  it("shows the request on the waiter's list, keeps the first time on a second tap, and a new round clears it", async () => {
    const { tab, guest, orders } = await openTab(["SERVED"]);
    const before = (await tabs(asA)).find((t) => t.sessionId === tab.id)!;
    expect(before).toMatchObject({ tableId: tableA.id, billRequestedAt: null, lastOrderAt: orders[0].createdAt.toISOString() });

    const first = await billRequestRoute(guestRequest(guest.token, "/api/orders/me/bill-request"));
    expect(first.status).toBe(200);
    const askedAt = (await first.json()).data.billRequestedAt;
    const second = await billRequestRoute(guestRequest(guest.token, "/api/orders/me/bill-request"));
    expect((await second.json()).data.billRequestedAt).toBe(askedAt);
    expect((await tabs(asA)).find((t) => t.sessionId === tab.id)!.billRequestedAt).toBe(askedAt);

    // Another business never sees this tab.
    expect((await tabs(asB)).some((t) => t.sessionId === tab.id)).toBe(false);

    const order = await submitOrderRoute(
      guestRequest(guest.token, "/api/orders", { items: [{ menuItemId: espresso.id, qty: 1 }] }, `key-${run}`),
    );
    expect(order.status).toBe(201);
    const after = (await tabs(asA)).find((t) => t.sessionId === tab.id)!;
    expect(after.billRequestedAt).toBeNull();
    expect(new Date(after.lastOrderAt!).getTime()).toBeGreaterThan(orders[0].createdAt.getTime());
  });

  it("refuses a request once the waiter closed the tab (the phone's session is revoked)", async () => {
    const { tab, guest } = await openTab(["SERVED"]);
    expect((await close(asA, tab.id)).status).toBe(200);

    const response = await billRequestRoute(guestRequest(guest.token, "/api/orders/me/bill-request"));

    expect(response.status).toBe(401);
    expect((await response.json()).message).toBe("guest_session_revoked");
  });
});
