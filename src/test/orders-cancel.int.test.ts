import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { POST as cancelRoute } from "@/app/api/orders/[id]/cancel/route";
import { GET as myOrdersRoute } from "@/app/api/orders/me/route";
import { GET as kitchenQueueRoute } from "@/app/api/kitchen/orders/route";
import { PATCH as kitchenStatusRoute } from "@/app/api/kitchen/[id]/route";
import { GET as billRoute } from "@/app/api/waiter/order/[id]/bill/route";
import type { OrderStatus } from "@/app/generated/prisma/client";

// A guest cancelling a round on a real database: the round, the tab's totals, this phone's list, the kitchen
// queue (crossed out for a minute) and the waiter's bill. And the race with the kitchen's Start: one wins.
const run = randomBytes(4).toString("hex");
let business: { id: string };
let kitchenUser: { id: string };
let waiterUser: { id: string };
let table: { id: string };
let espresso: { id: string };

const ROUND_USD = 5;
const ROUND_LBP = ROUND_USD * 89500;

function staff(role: "KITCHEN" | "WAITER", method: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = {
    "x-user-id": role === "KITCHEN" ? kitchenUser.id : waiterUser.id,
    "x-user-role": role,
    "x-business-id": business.id,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return new NextRequest("http://localhost/api/staff-call", {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function guest(token: string, path: string, method = "GET"): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const cancel = (token: string, orderId: string) =>
  cancelRoute(guest(token, `/api/orders/${orderId}/cancel`, "POST"), params(orderId));
const start = (orderId: string) => kitchenStatusRoute(staff("KITCHEN", "PATCH", { status: "PREPARING" }), params(orderId));

// An open tab with two phones; phone one has a round in each given status.
async function openTab(statuses: OrderStatus[]) {
  const tab = await prisma.tableSession.create({
    data: {
      businessId: business.id,
      tableId: table.id,
      activeTableId: table.id,
      totalUSD: ROUND_USD * statuses.length,
      totalLBP: ROUND_LBP * statuses.length,
    },
  });
  const phone = () =>
    prisma.guestSession.create({
      data: {
        sessionId: tab.id,
        token: randomBytes(32).toString("hex"),
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });
  const one = await phone();
  const two = await phone();
  const orders = [];
  for (const status of statuses) {
    orders.push(
      await prisma.diningOrder.create({
        data: {
          businessId: business.id,
          sessionId: tab.id,
          tableId: table.id,
          guestSessionId: one.id,
          status,
          totalUSD: ROUND_USD,
          totalLBP: ROUND_LBP,
          orderLines: {
            create: [{ menuItemId: espresso.id, qty: 2, priceUSD: "2.50", priceLBP: "223750", rateSnapshot: "89500" }],
          },
        },
      }),
    );
  }
  return { tab, one, two, orders };
}

beforeAll(async () => {
  business = await prisma.business.create({
    data: { name: `Test Cancel ${run}`, slug: `test-cancel-${run}`, exchangeRate: "89500", timezone: "Asia/Beirut" },
  });
  const user = (role: "KITCHEN" | "WAITER") =>
    prisma.user.create({
      data: { businessId: business.id, name: role, email: `${role.toLowerCase()}-${run}@example.test`, passwordHash: "x", role },
    });
  kitchenUser = await user("KITCHEN");
  waiterUser = await user("WAITER");
  table = await prisma.diningTable.create({
    data: { businessId: business.id, label: "T1", slug: "t1", qrToken: randomBytes(32).toString("hex") },
  });
  const category = await prisma.menuCategory.create({ data: { businessId: business.id, name: "Coffee" } });
  espresso = await prisma.menuItem.create({
    data: { businessId: business.id, categoryId: category.id, name: "Espresso", priceUSD: "2.50", priceLBP: "223750" },
  });
});

// One open tab per table, so each test starts with the table free.
beforeEach(async () => {
  await prisma.tableSession.updateMany({
    where: { tableId: table.id, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date(), activeTableId: null },
  });
});

afterAll(async () => {
  try {
    await prisma.diningOrder.deleteMany({ where: { businessId: business?.id } });
    await prisma.business.deleteMany({ where: { id: business?.id } });
  } finally {
    await prisma.$disconnect();
  }
});

describe("POST /api/orders/:id/cancel", () => {
  it("cancels a NEW round: off the tab, off this phone's list, crossed out in the kitchen, greyed for the waiter", async () => {
    const { tab, one, orders } = await openTab(["SERVED", "NEW"]);
    const round = orders[1];

    const response = await cancel(one.token, round.id);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ orderId: round.id, status: "CANCELLED" });

    const saved = await prisma.diningOrder.findUniqueOrThrow({ where: { id: round.id } });
    expect(saved.status).toBe("CANCELLED");
    expect(saved.cancelledAt).toBeInstanceOf(Date);
    const tabNow = await prisma.tableSession.findUniqueOrThrow({ where: { id: tab.id } });
    expect([tabNow.totalUSD.toFixed(2), tabNow.totalLBP.toFixed(2)]).toEqual(["5.00", "447500.00"]);

    const mine = (await (await myOrdersRoute(guest(one.token, "/api/orders/me"))).json()).data;
    expect(mine.orders.map((o: { orderId: string }) => o.orderId)).toEqual([orders[0].id]);
    expect([mine.guestTotalUSD, mine.totalUSD]).toEqual(["5.00", "5.00"]);

    const queue = (await (await kitchenQueueRoute(staff("KITCHEN", "GET"))).json()).data;
    const ticket = queue.find((t: { orderId: string }) => t.orderId === round.id);
    expect(ticket).toMatchObject({ status: "CANCELLED" });
    expect(ticket.cancelledAt).not.toBeNull();

    const bill = (await (await billRoute(staff("WAITER", "GET"), params(tab.id))).json()).data;
    expect(bill.orders.map((o: { status: string }) => o.status)).toEqual(["SERVED", "CANCELLED"]);
    expect([bill.orderCount, bill.totalUSD]).toEqual([1, "5.00"]);
  });

  it("drops a cancelled round from the kitchen queue a minute later", async () => {
    const { one, orders } = await openTab(["NEW"]);
    expect((await cancel(one.token, orders[0].id)).status).toBe(200);
    await prisma.diningOrder.update({
      where: { id: orders[0].id },
      data: { cancelledAt: new Date(Date.now() - 61_000) },
    });

    const queue = (await (await kitchenQueueRoute(staff("KITCHEN", "GET"))).json()).data;
    expect(queue.map((t: { orderId: string }) => t.orderId)).not.toContain(orders[0].id);
  });

  it("refuses a round the kitchen started (409), and the kitchen can't start a cancelled one (409)", async () => {
    const { one, orders } = await openTab(["PREPARING", "NEW"]);

    const late = await cancel(one.token, orders[0].id);
    expect(late.status).toBe(409);
    expect((await late.json()).message).toBe("cannot_cancel_order_already_in_progress");

    expect((await cancel(one.token, orders[1].id)).status).toBe(200);
    const startCancelled = await start(orders[1].id);
    expect(startCancelled.status).toBe(409);
    expect((await startCancelled.json()).message).toBe("order_cancelled");

    const again = await cancel(one.token, orders[1].id);
    expect([again.status, (await again.json()).message]).toEqual([409, "order_already_cancelled"]);
  });

  it("answers 404 for another phone's round at the same table, and changes nothing", async () => {
    const { tab, two, orders } = await openTab(["NEW"]);

    const response = await cancel(two.token, orders[0].id);
    expect([response.status, (await response.json()).message]).toEqual([404, "order_not_found"]);
    expect((await prisma.diningOrder.findUniqueOrThrow({ where: { id: orders[0].id } })).status).toBe("NEW");
    expect((await prisma.tableSession.findUniqueOrThrow({ where: { id: tab.id } })).totalUSD.toFixed(2)).toBe("5.00");
  });

  it("lets exactly one of a cancel and a kitchen Start win when they race", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await prisma.tableSession.updateMany({
        where: { tableId: table.id, status: "OPEN" },
        data: { status: "CLOSED", closedAt: new Date(), activeTableId: null },
      });
      const { tab, one, orders } = await openTab(["NEW"]);

      const [cancelled, started] = await Promise.all([cancel(one.token, orders[0].id), start(orders[0].id)]);
      const statuses = [cancelled.status, started.status].sort();
      expect(statuses).toEqual([200, 409]);

      const round = await prisma.diningOrder.findUniqueOrThrow({ where: { id: orders[0].id } });
      const tabNow = await prisma.tableSession.findUniqueOrThrow({ where: { id: tab.id } });
      if (cancelled.status === 200) {
        expect([round.status, tabNow.totalUSD.toFixed(2)]).toEqual(["CANCELLED", "0.00"]);
      } else {
        expect([round.status, tabNow.totalUSD.toFixed(2)]).toEqual(["PREPARING", "5.00"]);
      }
    }
  });
});
