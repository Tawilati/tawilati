// src/test/OrderService.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import { HttpException } from "@/utils/exceptions/http/HttpException";
import { hashOrderLines } from "@/utils/OrderHash";

// ── Mock the repo modules and the transaction ─────────────────
const repos = vi.hoisted(() => ({
  guestSessionRepo: { FindByToken: vi.fn(), extend: vi.fn() },
  submissionRepo: { FindByKey: vi.fn(), create: vi.fn(), linkToOrder: vi.fn() },
  orderRepo: {
    findByIdWithRelations: vi.fn(),
    create: vi.fn(),
    findGuestOrderForCancel: vi.fn(),
    cancelOrderAndUpdateBill: vi.fn(),
  },
  menuItemRepo: { findManyByIds: vi.fn(), findBusinessExchangeRate: vi.fn() },
  tableSessionRepo: { updateTotals: vi.fn(), requestBill: vi.fn() },
  tx: { fake: "transaction" },
}));

vi.mock("@/repository/GuestSessionRepo", () => ({ guestSessionRepo: repos.guestSessionRepo }));
vi.mock("@/repository/SubmissionRepo", () => ({ submissionRepo: repos.submissionRepo }));
vi.mock("@/repository/OrderRepo", () => ({ orderRepo: repos.orderRepo }));
vi.mock("@/repository/MenuItemsRepo", () => ({ menuItemRepo: repos.menuItemRepo }));
vi.mock("@/repository/TabelSession", () => ({ tableSessionRepo: repos.tableSessionRepo }));
vi.mock("@/lib/db", () => ({
  prisma: { $transaction: vi.fn((run: (tx: unknown) => unknown) => run(repos.tx)) },
}));

import { orderService } from "@/service/OrderService";

const { guestSessionRepo, submissionRepo, orderRepo, menuItemRepo, tableSessionRepo, tx } = repos;

// ── Fixtures ──────────────────────────────────────────────────
const TOKEN = "b".repeat(64);
const KEY = "key-1";
const ESPRESSO = "item-espresso";
const CAKE = "item-cake";

function guest(overrides: Record<string, unknown> = {}, sessionOverrides: Record<string, unknown> = {}) {
  return {
    id: "guest-1",
    sessionId: "session-1",
    token: TOKEN,
    status: "ACTIVE",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: null,
    session: { id: "session-1", businessId: "biz-1", tableId: "table-1", status: "OPEN", ...sessionOverrides },
    ...overrides,
  };
}

function menuItem(id: string, priceUSD: string, priceLBP: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    businessId: "biz-1",
    categoryId: "cat-1",
    name: id,
    priceUSD: new Prisma.Decimal(priceUSD),
    priceLBP: new Prisma.Decimal(priceLBP),
    soldOut: false,
    archivedAt: null,
    ...overrides,
  };
}

function orderRecord(id = "order-1") {
  return {
    id,
    sessionId: "session-1",
    status: "NEW",
    totalUSD: new Prisma.Decimal("8.50"),
    totalLBP: new Prisma.Decimal("760750"),
    createdAt: new Date("2026-10-30T10:00:00.000Z"),
    table: { label: "T1" },
    orderLines: [
      { menuItemId: ESPRESSO, qty: 2, priceUSD: new Prisma.Decimal("2.5"), priceLBP: new Prisma.Decimal("223750"), menuItem: { name: "Espresso" } },
      { menuItemId: CAKE, qty: 1, priceUSD: new Prisma.Decimal("3.5"), priceLBP: new Prisma.Decimal("313250"), menuItem: { name: "Cake" } },
    ],
  };
}

const items = [
  { menuItemId: ESPRESSO, qty: 2 },
  { menuItemId: CAKE, qty: 1 },
];
const input = { guestToken: TOKEN, idempotencyKey: KEY, items };

async function expectHttpError(promise: Promise<unknown>, status: number, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  expect(error).toMatchObject({ status, message: code });
}

function expectNothingWritten() {
  expect(submissionRepo.create).not.toHaveBeenCalled();
  expect(orderRepo.create).not.toHaveBeenCalled();
  expect(tableSessionRepo.updateTotals).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  guestSessionRepo.FindByToken.mockResolvedValue(guest());
  submissionRepo.FindByKey.mockResolvedValue(null);
  menuItemRepo.findManyByIds.mockResolvedValue([
    menuItem(ESPRESSO, "2.50", "223750"),
    menuItem(CAKE, "3.50", "313250"),
  ]);
  menuItemRepo.findBusinessExchangeRate.mockResolvedValue(new Prisma.Decimal("89500"));
  submissionRepo.create.mockResolvedValue({ id: "submission-1" });
  orderRepo.create.mockResolvedValue(orderRecord());
});

// ── Tests ─────────────────────────────────────────────────────
describe("OrderService.createOrder", () => {
  describe("new submission", () => {
    it("creates the order for an approved guest with price snapshots and Decimal totals in one transaction", async () => {
      const result = await orderService.createOrder(input);

      expect(result.created).toBe(true);
      expect(result.order).toMatchObject({
        submissionId: "submission-1",
        orderId: "order-1",
        tableLabel: "T1",
        status: "NEW",
        totalUSD: "8.50",
        totalLBP: "760750.00",
      });

      expect(submissionRepo.create).toHaveBeenCalledWith(
        { businessId: "biz-1", idempotencyKey: KEY, payloadHash: hashOrderLines(items) },
        tx,
      );

      const [orderData, orderTx] = orderRepo.create.mock.calls[0];
      expect(orderTx).toBe(tx);
      expect(orderData).toMatchObject({
        businessId: "biz-1",
        sessionId: "session-1",
        tableId: "table-1",
        guestSessionId: "guest-1",
      });
      expect(orderData.totalUSD.toFixed(2)).toBe("8.50");
      expect(orderData.totalLBP.toFixed(2)).toBe("760750.00");
      expect(orderData.lines[0].rateSnapshot.toString()).toBe("89500");
      expect(orderData.lines[0].priceUSD.toFixed(2)).toBe("2.50");

      expect(submissionRepo.linkToOrder).toHaveBeenCalledWith("submission-1", "order-1", tx);
      expect(tableSessionRepo.updateTotals).toHaveBeenCalledWith(
        "session-1",
        orderData.totalUSD,
        orderData.totalLBP,
        tx,
      );
      expect(guestSessionRepo.FindByToken).toHaveBeenCalledWith(TOKEN);
    });

    it("looks the menu items up in the guest's business only", async () => {
      await orderService.createOrder(input);

      expect(menuItemRepo.findManyByIds).toHaveBeenCalledWith("biz-1", [ESPRESSO, CAKE]);
      expect(submissionRepo.FindByKey).toHaveBeenCalledWith("biz-1", KEY);
    });

    it("counts a repeated item once when loading but keeps every line", async () => {
      menuItemRepo.findManyByIds.mockResolvedValue([menuItem(ESPRESSO, "2.50", "223750")]);

      await orderService.createOrder({
        ...input,
        items: [
          { menuItemId: ESPRESSO, qty: 1 },
          { menuItemId: ESPRESSO, qty: 2 },
        ],
      });

      expect(menuItemRepo.findManyByIds).toHaveBeenCalledWith("biz-1", [ESPRESSO]);
      expect(orderRepo.create.mock.calls[0][0].lines).toHaveLength(2);
      expect(orderRepo.create.mock.calls[0][0].totalUSD.toFixed(2)).toBe("7.50");
    });
  });

  describe("guest session", () => {
    it("rejects an unknown token with 401", async () => {
      guestSessionRepo.FindByToken.mockResolvedValue(null);

      await expectHttpError(orderService.createOrder(input), 401, "unauthorized");
      expectNothingWritten();
    });

    it("rejects an expired session with 401", async () => {
      guestSessionRepo.FindByToken.mockResolvedValue(guest({ expiresAt: new Date(Date.now() - 1000) }));

      await expectHttpError(orderService.createOrder(input), 401, "token_expired");
      expectNothingWritten();
    });

    it("rejects a revoked session with 401 guest_session_revoked", async () => {
      guestSessionRepo.FindByToken.mockResolvedValue(guest({ revokedAt: new Date() }));

      await expectHttpError(orderService.createOrder(input), 401, "guest_session_revoked");
      expectNothingWritten();
    });

    it("rejects a closed tab with 409", async () => {
      guestSessionRepo.FindByToken.mockResolvedValue(guest({}, { status: "CLOSED" }));

      await expectHttpError(orderService.createOrder(input), 409, "table_session_closed");
      expectNothingWritten();
    });

    it("rejects an unapproved guest with 403 before creating an order", async () => {
      guestSessionRepo.FindByToken.mockResolvedValue(guest({ status: "PENDING" }));

      await expectHttpError(orderService.createOrder(input), 403, "guest_session_pending_approval");
      expectNothingWritten();
      expect(submissionRepo.FindByKey).not.toHaveBeenCalled();
      expect(menuItemRepo.findManyByIds).not.toHaveBeenCalled();
    });
  });

  describe("idempotency", () => {
    it("requires an idempotency key", async () => {
      await expectHttpError(
        orderService.createOrder({ ...input, idempotencyKey: "" }),
        400,
        "idempotency_key_required",
      );
      expectNothingWritten();
    });

    it("returns the original order for a retry with the same cart, writing nothing", async () => {
      submissionRepo.FindByKey.mockResolvedValue({
        id: "submission-1",
        orderId: "order-1",
        payloadHash: hashOrderLines(items),
      });
      orderRepo.findByIdWithRelations.mockResolvedValue(orderRecord());

      const result = await orderService.createOrder(input);

      expect(result.created).toBe(false);
      expect(result.order).toMatchObject({ submissionId: "submission-1", orderId: "order-1" });
      expectNothingWritten();
    });

    it("treats the same cart in another order as a retry", async () => {
      submissionRepo.FindByKey.mockResolvedValue({
        id: "submission-1",
        orderId: "order-1",
        payloadHash: hashOrderLines(items),
      });
      orderRepo.findByIdWithRelations.mockResolvedValue(orderRecord());

      const result = await orderService.createOrder({ ...input, items: [...items].reverse() });

      expect(result.created).toBe(false);
    });

    it("rejects the same key with a different cart with 409 idempotency_key_mismatch", async () => {
      submissionRepo.FindByKey.mockResolvedValue({
        id: "submission-1",
        orderId: "order-1",
        payloadHash: hashOrderLines([{ menuItemId: ESPRESSO, qty: 5 }]),
      });

      await expectHttpError(orderService.createOrder(input), 409, "idempotency_key_mismatch");
      expectNothingWritten();
    });

    it("answers 500 when a submission has no order", async () => {
      submissionRepo.FindByKey.mockResolvedValue({
        id: "submission-1",
        orderId: null,
        payloadHash: hashOrderLines(items),
      });

      await expectHttpError(orderService.createOrder(input), 500, "order_link_corrupted");
    });
  });

  describe("menu items", () => {
    it("rejects an item from another business (not found) with 400", async () => {
      menuItemRepo.findManyByIds.mockResolvedValue([menuItem(ESPRESSO, "2.50", "223750")]);

      await expectHttpError(orderService.createOrder(input), 400, "menu_item_not_found");
      expectNothingWritten();
    });

    it("rejects an archived item with 409", async () => {
      menuItemRepo.findManyByIds.mockResolvedValue([
        menuItem(ESPRESSO, "2.50", "223750"),
        menuItem(CAKE, "3.50", "313250", { archivedAt: new Date() }),
      ]);

      await expectHttpError(orderService.createOrder(input), 409, "menu_item_archived");
      expectNothingWritten();
    });

    it("rejects a sold-out item with 409", async () => {
      menuItemRepo.findManyByIds.mockResolvedValue([
        menuItem(ESPRESSO, "2.50", "223750", { soldOut: true }),
        menuItem(CAKE, "3.50", "313250"),
      ]);

      await expectHttpError(orderService.createOrder(input), 409, "menu_item_sold_out");
      expectNothingWritten();
    });

    it("rejects a quantity below 1 with 400", async () => {
      await expectHttpError(
        orderService.createOrder({ ...input, items: [{ menuItemId: ESPRESSO, qty: 0 }, items[1]] }),
        400,
        "invalid_quantity",
      );
      expectNothingWritten();
    });
  });
});

describe("OrderService.requestBill", () => {
  it("stamps the guest's tab and returns the time", async () => {
    const at = new Date("2026-11-03T12:00:00.000Z");
    guestSessionRepo.FindByToken.mockResolvedValue(guest());
    tableSessionRepo.requestBill.mockResolvedValue(at);

    await expect(orderService.requestBill(TOKEN)).resolves.toEqual({ billRequestedAt: at.toISOString() });
    expect(guestSessionRepo.FindByToken).toHaveBeenCalledWith(TOKEN);
    expect(tableSessionRepo.requestBill).toHaveBeenCalledWith("session-1");
  });

  it("answers 401 unauthorized for an unknown token", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(null);

    await expectHttpError(orderService.requestBill(TOKEN), 401, "unauthorized");
    expect(tableSessionRepo.requestBill).not.toHaveBeenCalled();
  });

  it("answers 401 token_expired so the phone renews and asks again", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(guest({ expiresAt: new Date(Date.now() - 1000) }));

    await expectHttpError(orderService.requestBill(TOKEN), 401, "token_expired");
    expect(tableSessionRepo.requestBill).not.toHaveBeenCalled();
  });

  it("answers 401 guest_session_revoked once the waiter closed the tab", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(guest({ revokedAt: new Date() }));

    await expectHttpError(orderService.requestBill(TOKEN), 401, "guest_session_revoked");
    expect(tableSessionRepo.requestBill).not.toHaveBeenCalled();
  });

  it("answers 409 table_session_closed for a closed tab", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(guest({}, { status: "CLOSED" }));

    await expectHttpError(orderService.requestBill(TOKEN), 409, "table_session_closed");
    expect(tableSessionRepo.requestBill).not.toHaveBeenCalled();
  });

  it("answers 409 table_session_closed when the tab closed just before the update", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(guest());
    tableSessionRepo.requestBill.mockResolvedValue(null);

    await expectHttpError(orderService.requestBill(TOKEN), 409, "table_session_closed");
  });
});

describe("OrderService.splitBill", () => {
  const tab = { totalUSD: new Prisma.Decimal("6.00"), totalLBP: new Prisma.Decimal("537000"), table: { label: "T1" } };

  it("divides the tab's totals by the number of people", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(guest({}, tab));

    await expect(orderService.splitBill(TOKEN, 4)).resolves.toEqual({
      sessionId: "session-1",
      tableLabel: "T1",
      totalUSD: "6.00",
      totalLBP: "537000.00",
      splitCount: 4,
      perPersonUSD: "1.50",
      perPersonLBP: "134250.00",
    });
    expect(guestSessionRepo.FindByToken).toHaveBeenCalledWith(TOKEN);
  });

  it("rounds an uneven share to the nearest cent, half up", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(guest({}, { ...tab, totalUSD: new Prisma.Decimal("5.00") }));

    await expect(orderService.splitBill(TOKEN, 3)).resolves.toMatchObject({ perPersonUSD: "1.67" });
  });

  it("answers 401 unauthorized for an unknown token", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(null);

    await expectHttpError(orderService.splitBill(TOKEN, 2), 401, "unauthorized");
  });

  it("answers 401 token_expired so the phone renews and asks again", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(guest({ expiresAt: new Date(Date.now() - 1000) }, tab));

    await expectHttpError(orderService.splitBill(TOKEN, 2), 401, "token_expired");
  });

  it("answers 401 guest_session_revoked once the waiter closed the tab", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(guest({ revokedAt: new Date() }, tab));

    await expectHttpError(orderService.splitBill(TOKEN, 2), 401, "guest_session_revoked");
  });

  it("answers 409 table_session_closed for a closed tab", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(guest({}, { ...tab, status: "CLOSED" }));

    await expectHttpError(orderService.splitBill(TOKEN, 2), 409, "table_session_closed");
  });

  it("answers 400 invalid_split_count outside 1 to 50", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(guest({}, tab));

    await expectHttpError(orderService.splitBill(TOKEN, 0), 400, "invalid_split_count");
    await expectHttpError(orderService.splitBill(TOKEN, 51), 400, "invalid_split_count");
  });
});

// ── Cancelling a round (guest) ────────────────────────────────
describe("orderService.cancelGuestOrder", () => {
  const ORDER = "f0000000-0000-4000-8000-000000000001";
  const newRound = {
    id: ORDER,
    status: "NEW",
    sessionId: "session-1",
    totalUSD: new Prisma.Decimal("5.00"),
    totalLBP: new Prisma.Decimal("447500"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    guestSessionRepo.FindByToken.mockResolvedValue(guest());
    orderRepo.findGuestOrderForCancel.mockResolvedValue(newRound);
    orderRepo.cancelOrderAndUpdateBill.mockResolvedValue(true);
  });

  it("cancels this phone's NEW round and takes it off the tab, in one transaction", async () => {
    await expect(orderService.cancelGuestOrder(ORDER, TOKEN)).resolves.toEqual({ orderId: ORDER, status: "CANCELLED" });
    expect(orderRepo.findGuestOrderForCancel).toHaveBeenCalledWith(ORDER, "guest-1");
    expect(orderRepo.cancelOrderAndUpdateBill).toHaveBeenCalledWith(
      ORDER, "session-1", newRound.totalUSD, newRound.totalLBP, tx,
    );
  });

  it("answers 404 order_not_found for a round that isn't this phone's", async () => {
    orderRepo.findGuestOrderForCancel.mockResolvedValue(null);
    await expectHttpError(orderService.cancelGuestOrder(ORDER, TOKEN), 404, "order_not_found");
    expect(orderRepo.cancelOrderAndUpdateBill).not.toHaveBeenCalled();
  });

  it.each(["PREPARING", "READY", "SERVED"])("answers 409 when the round is already %s, with no write", async (status) => {
    orderRepo.findGuestOrderForCancel.mockResolvedValue({ ...newRound, status });
    await expectHttpError(orderService.cancelGuestOrder(ORDER, TOKEN), 409, "cannot_cancel_order_already_in_progress");
    expect(orderRepo.cancelOrderAndUpdateBill).not.toHaveBeenCalled();
  });

  it("answers 409 order_already_cancelled on a second cancel, with no write", async () => {
    orderRepo.findGuestOrderForCancel.mockResolvedValue({ ...newRound, status: "CANCELLED" });
    await expectHttpError(orderService.cancelGuestOrder(ORDER, TOKEN), 409, "order_already_cancelled");
    expect(orderRepo.cancelOrderAndUpdateBill).not.toHaveBeenCalled();
  });

  it("answers 409 when the kitchen starts the round between the read and the write", async () => {
    orderRepo.cancelOrderAndUpdateBill.mockResolvedValue(false);
    await expectHttpError(orderService.cancelGuestOrder(ORDER, TOKEN), 409, "cannot_cancel_order_already_in_progress");
  });

  it("refuses a closed tab with 409 table_session_closed", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(guest({}, { status: "CLOSED" }));
    await expectHttpError(orderService.cancelGuestOrder(ORDER, TOKEN), 409, "table_session_closed");
    expect(orderRepo.cancelOrderAndUpdateBill).not.toHaveBeenCalled();
  });

  it("refuses an unknown token with 401", async () => {
    guestSessionRepo.FindByToken.mockResolvedValue(null);
    await expectHttpError(orderService.cancelGuestOrder(ORDER, TOKEN), 401, "unauthorized");
  });
});
