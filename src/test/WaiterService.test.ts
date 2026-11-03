import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import { HttpException } from "@/utils/exceptions/http/HttpException";

// ── Mock the repository module and the transaction ────────────
const repo = vi.hoisted(() => ({
  waiterRepo: {
    findActiveTables: vi.fn(),
    findOrderForWaiter: vi.fn(),
    markOrderAsServed: vi.fn(),
    findBillBySessionId: vi.fn(),
    findSessionForClose: vi.fn(),
    closeIfOpen: vi.fn(),
    countUnservedOrders: vi.fn(),
    createPayment: vi.fn(),
    revokeGuestSessions: vi.fn(),
  },
  tx: { fake: "transaction" },
}));

vi.mock("@/repository/WaiterRepo", () => ({ waiterRepo: repo.waiterRepo }));
vi.mock("@/lib/db", () => ({
  prisma: { $transaction: vi.fn((run: (tx: unknown) => unknown) => run(repo.tx)) },
}));

import { WaiterService, waiterService } from "@/service/WaiterService";

const { waiterRepo, tx } = repo;
const BUSINESS = "business-1";
const SESSION = "session-1";
const WAITER = "waiter-1";

async function rejection(promise: Promise<unknown>): Promise<HttpException> {
  const error = await promise.then(
    () => { throw new Error("expected a rejection"); },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(HttpException);
  return error as HttpException;
}

function openTab(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION,
    status: "OPEN",
    totalUSD: new Prisma.Decimal("12.10"),
    totalLBP: new Prisma.Decimal("1076900.00"),
    amountPaidUSD: new Prisma.Decimal("0"),
    amountPaidLBP: new Prisma.Decimal("0"),
    ...overrides,
  };
}

const cash = { amountReceivedUSD: 20, amountReceivedLBP: 0, method: "CASH" as const };

beforeEach(() => {
  vi.clearAllMocks();
  waiterRepo.closeIfOpen.mockResolvedValue(true);
  waiterRepo.countUnservedOrders.mockResolvedValue(0);
  waiterRepo.createPayment.mockResolvedValue({ id: "payment-1" });
  waiterRepo.revokeGuestSessions.mockResolvedValue(undefined);
});

it("returns the same singleton instance", () => {
  expect(WaiterService.getInstance()).toBe(waiterService);
});

describe("markOrderServed", () => {
  it("moves a READY round to SERVED", async () => {
    waiterRepo.findOrderForWaiter.mockResolvedValue({ id: "order-1", status: "READY" });
    waiterRepo.markOrderAsServed.mockResolvedValue({ id: "order-1", status: "SERVED" });

    await expect(waiterService.markOrderServed("order-1", BUSINESS)).resolves.toEqual({
      orderId: "order-1",
      status: "SERVED",
    });
    expect(waiterRepo.findOrderForWaiter).toHaveBeenCalledWith("order-1", BUSINESS);
  });

  it("answers 404 not_found for a round that isn't in this business", async () => {
    waiterRepo.findOrderForWaiter.mockResolvedValue(null);

    const error = await rejection(waiterService.markOrderServed("order-1", BUSINESS));
    expect([error.status, error.message]).toEqual([404, "not_found"]);
    expect(waiterRepo.markOrderAsServed).not.toHaveBeenCalled();
  });

  it.each(["NEW", "PREPARING", "SERVED", "CANCELLED"])(
    "answers 400 invalid_transition from %s, with no write",
    async (status) => {
      waiterRepo.findOrderForWaiter.mockResolvedValue({ id: "order-1", status });

      const error = await rejection(waiterService.markOrderServed("order-1", BUSINESS));
      expect([error.status, error.message]).toEqual([400, "invalid_transition"]);
      expect(waiterRepo.markOrderAsServed).not.toHaveBeenCalled();
    },
  );
});

describe("getBill", () => {
  it("answers 404 not_found for a tab that isn't in this business", async () => {
    waiterRepo.findBillBySessionId.mockResolvedValue(null);

    const error = await rejection(waiterService.getBill(SESSION, BUSINESS));
    expect([error.status, error.message]).toEqual([404, "not_found"]);
    expect(waiterRepo.findBillBySessionId).toHaveBeenCalledWith(SESSION, BUSINESS);
  });

  it("maps every round with its lines and the tab's totals", async () => {
    const createdAt = new Date("2026-11-03T10:00:00Z");
    waiterRepo.findBillBySessionId.mockResolvedValue({
      ...openTab(),
      openedAt: createdAt,
      table: { label: "T1" },
      orders: [
        {
          id: "order-1",
          status: "SERVED",
          totalUSD: new Prisma.Decimal("5.00"),
          totalLBP: new Prisma.Decimal("445000.00"),
          createdAt,
          orderLines: [{
            menuItemId: "esp",
            qty: 2,
            priceUSD: new Prisma.Decimal("2.50"),
            priceLBP: new Prisma.Decimal("222500.00"),
            rateSnapshot: new Prisma.Decimal("89000"),
            menuItem: { name: "Espresso" },
          }],
        },
        {
          id: "order-2",
          status: "PREPARING",
          totalUSD: new Prisma.Decimal("7.10"),
          totalLBP: new Prisma.Decimal("631900.00"),
          createdAt,
          orderLines: [],
        },
      ],
    });

    const bill = await waiterService.getBill(SESSION, BUSINESS);

    expect(bill).toMatchObject({
      sessionId: SESSION,
      tableLabel: "T1",
      orderCount: 2,
      totalUSD: "12.10",
      totalLBP: "1076900.00",
    });
    expect(bill.orders.map((o) => [o.orderId, o.status])).toEqual([
      ["order-1", "SERVED"],
      ["order-2", "PREPARING"],
    ]);
    expect(bill.orders[0].lines[0]).toEqual({
      menuItemId: "esp",
      name: "Espresso",
      qty: 2,
      priceUSD: "2.50",
      priceLBP: "222500.00",
      rateSnapshot: "89000.00",
    });
  });
});

describe("closeTab", () => {
  it("closes the tab, records the payment, revokes the phones and returns the receipt", async () => {
    waiterRepo.findSessionForClose.mockResolvedValue(openTab());

    const receipt = await waiterService.closeTab(SESSION, BUSINESS, WAITER, cash);

    expect(waiterRepo.findSessionForClose).toHaveBeenCalledWith(SESSION, BUSINESS);
    expect(waiterRepo.closeIfOpen).toHaveBeenCalledWith(
      {
        sessionId: SESSION,
        businessId: BUSINESS,
        amountPaidUSD: new Prisma.Decimal("12.10"),
        amountPaidLBP: new Prisma.Decimal("1076900.00"),
      },
      tx,
    );
    expect(waiterRepo.countUnservedOrders).toHaveBeenCalledWith(SESSION, tx);
    expect(waiterRepo.createPayment).toHaveBeenCalledWith(
      {
        sessionId: SESSION,
        amountUSD: new Prisma.Decimal("12.10"),
        amountLBP: new Prisma.Decimal("1076900.00"),
        method: "CASH",
        recordedById: WAITER,
      },
      tx,
    );
    expect(waiterRepo.revokeGuestSessions).toHaveBeenCalledWith(SESSION, tx);
    expect(receipt).toEqual({
      sessionId: SESSION,
      status: "CLOSED",
      totalUSD: "12.10",
      totalLBP: "1076900.00",
      amountPaidUSD: "12.10",
      amountPaidLBP: "1076900.00",
      amountReceivedUSD: "20.00",
      amountReceivedLBP: "0.00",
      changeUSD: "7.90",
      changeLBP: "0.00",
      paymentId: "payment-1",
    });
  });

  it("answers 404 not_found for a tab that isn't in this business", async () => {
    waiterRepo.findSessionForClose.mockResolvedValue(null);

    const error = await rejection(waiterService.closeTab(SESSION, BUSINESS, WAITER, cash));
    expect([error.status, error.message]).toEqual([404, "not_found"]);
    expect(waiterRepo.closeIfOpen).not.toHaveBeenCalled();
  });

  it("answers 409 table_session_closed for a tab that is already closed", async () => {
    waiterRepo.findSessionForClose.mockResolvedValue(openTab({ status: "CLOSED" }));

    const error = await rejection(waiterService.closeTab(SESSION, BUSINESS, WAITER, cash));
    expect([error.status, error.message]).toEqual([409, "table_session_closed"]);
    expect(waiterRepo.closeIfOpen).not.toHaveBeenCalled();
    expect(waiterRepo.createPayment).not.toHaveBeenCalled();
  });

  it("answers 409 table_session_closed and records nothing when another close got there first", async () => {
    waiterRepo.findSessionForClose.mockResolvedValue(openTab());
    waiterRepo.closeIfOpen.mockResolvedValue(false);

    const error = await rejection(waiterService.closeTab(SESSION, BUSINESS, WAITER, cash));
    expect([error.status, error.message]).toEqual([409, "table_session_closed"]);
    expect(waiterRepo.createPayment).not.toHaveBeenCalled();
    expect(waiterRepo.revokeGuestSessions).not.toHaveBeenCalled();
  });

  it("answers 409 tab_not_settleable while a round is not served yet, and records nothing", async () => {
    waiterRepo.findSessionForClose.mockResolvedValue(openTab());
    waiterRepo.countUnservedOrders.mockResolvedValue(1);

    const error = await rejection(waiterService.closeTab(SESSION, BUSINESS, WAITER, cash));
    expect([error.status, error.message]).toEqual([409, "tab_not_settleable"]);
    expect(waiterRepo.createPayment).not.toHaveBeenCalled();
    expect(waiterRepo.revokeGuestSessions).not.toHaveBeenCalled();
  });

  it("closes an empty tab without a payment", async () => {
    waiterRepo.findSessionForClose.mockResolvedValue(
      openTab({ totalUSD: new Prisma.Decimal("0"), totalLBP: new Prisma.Decimal("0") }),
    );

    const receipt = await waiterService.closeTab(SESSION, BUSINESS, WAITER, {
      amountReceivedUSD: 0,
      amountReceivedLBP: 0,
      method: "CASH",
    });

    expect(waiterRepo.createPayment).not.toHaveBeenCalled();
    expect(waiterRepo.revokeGuestSessions).toHaveBeenCalledWith(SESSION, tx);
    expect(receipt).toMatchObject({ status: "CLOSED", totalUSD: "0.00", paymentId: null });
  });

  it("answers 400 insufficient_payment when both currencies are short, before any write", async () => {
    waiterRepo.findSessionForClose.mockResolvedValue(openTab());

    const error = await rejection(
      waiterService.closeTab(SESSION, BUSINESS, WAITER, { ...cash, amountReceivedUSD: 10 }),
    );
    expect([error.status, error.message]).toEqual([400, "insufficient_payment"]);
    expect(waiterRepo.closeIfOpen).not.toHaveBeenCalled();
  });
});
