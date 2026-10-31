// src/test/OrderService.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import { HttpException } from "@/utils/exceptions/http/HttpException";
import { hashOrderLines } from "@/utils/OrderHash";

// ── Mock the repo modules and the transaction ─────────────────
const repos = vi.hoisted(() => ({
  guestSessionRepo: { FindByToken: vi.fn(), extend: vi.fn() },
  submissionRepo: { FindByKey: vi.fn(), create: vi.fn(), linkToOrder: vi.fn() },
  orderRepo: { findByIdWithRelations: vi.fn(), create: vi.fn() },
  menuItemRepo: { findManyByIds: vi.fn(), findBusinessExchangeRate: vi.fn() },
  tableSessionRepo: { updateTotals: vi.fn() },
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
    it("creates the order with price snapshots and Decimal totals in one transaction", async () => {
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
