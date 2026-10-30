import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/orders/route";
import { AuthenticationException } from "@/utils/exceptions/http/AuthenticationException";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { HttpException } from "@/utils/exceptions/http/HttpException";
import { DBException } from "@/utils/exceptions/RepoException";

const mockedOrderService = vi.hoisted(() => ({
  createOrder: vi.fn(),
}));

vi.mock("@/service/OrderService", () => ({
  orderService: mockedOrderService,
}));

const GUEST_TOKEN = "b".repeat(64);
const IDEMPOTENCY_KEY = "5f1c7a2e-1d3b-4c55-9a77-0d2b8e6f4a10";
const ITEM_ID = "d0000000-0000-4000-8000-000000000001";
const body = { items: [{ menuItemId: ITEM_ID, qty: 2 }] };

function makeRequest(
  payload?: unknown,
  {
    token = GUEST_TOKEN,
    key = IDEMPOTENCY_KEY,
    invalidJson = false,
  }: { token?: string | null; key?: string | null; invalidJson?: boolean } = {},
): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  if (key !== null) headers["idempotency-key"] = key;

  return new NextRequest("http://localhost/api/orders", {
    method: "POST",
    headers,
    body: invalidJson ? "{ not json" : JSON.stringify(payload ?? {}),
  });
}

const order = {
  submissionId: "e0000000-0000-4000-8000-000000000001",
  orderId: "f0000000-0000-4000-8000-000000000001",
  sessionId: "c0000000-0000-4000-8000-000000000001",
  tableLabel: "T1",
  status: "NEW",
  totalUSD: "5.00",
  totalLBP: "447500.00",
  lines: [
    { menuItemId: ITEM_ID, name: "Espresso", qty: 2, priceUSD: "2.50", priceLBP: "223750.00" },
  ],
  createdAt: new Date("2026-10-30T10:00:00.000Z"),
};

const orderJson = { ...order, createdAt: order.createdAt.toISOString() };

beforeEach(() => {
  vi.clearAllMocks();
  mockedOrderService.createOrder.mockResolvedValue({ created: true, order });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/orders", () => {
  describe("successful", () => {
    it("returns 201 with the new order", async () => {
      const response = await POST(makeRequest(body));

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        success: true,
        message: "order submitted",
        data: orderJson,
      });
      expect(mockedOrderService.createOrder).toHaveBeenCalledWith({
        guestToken: GUEST_TOKEN,
        idempotencyKey: IDEMPOTENCY_KEY,
        items: body.items,
      });
    });

    it("returns 200 with the original order when the submission is retried", async () => {
      mockedOrderService.createOrder.mockResolvedValue({ created: false, order });

      const response = await POST(makeRequest(body));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        message: "order already submitted",
        data: orderJson,
      });
    });
  });

  describe("guest authentication", () => {
    it("returns 401 unauthorized without an Authorization header", async () => {
      const response = await POST(makeRequest(body, { token: null }));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ success: false, message: "unauthorized" });
      expect(mockedOrderService.createOrder).not.toHaveBeenCalled();
    });

    it.each(["too-short", "B".repeat(64)])(
      "returns 401 unauthorized for a malformed token",
      async (token) => {
        const response = await POST(makeRequest(body, { token }));

        expect(response.status).toBe(401);
        expect(mockedOrderService.createOrder).not.toHaveBeenCalled();
      },
    );

    it("returns 401 when the service rejects the guest session", async () => {
      mockedOrderService.createOrder.mockRejectedValue(
        new HttpException(401, "guest_session_revoked"),
      );

      const response = await POST(makeRequest(body));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        success: false,
        message: "guest_session_revoked",
      });
    });

    it("returns 401 for an unknown token", async () => {
      mockedOrderService.createOrder.mockRejectedValue(
        new AuthenticationException("unauthorized"),
      );

      const response = await POST(makeRequest(body));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ success: false, message: "unauthorized" });
    });
  });

  describe("idempotency key", () => {
    it.each([null, "", "   ", "k".repeat(256)])(
      "returns 400 idempotency_key_required for key %j",
      async (key) => {
        const response = await POST(makeRequest(body, { key }));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          success: false,
          message: "idempotency_key_required",
        });
        expect(mockedOrderService.createOrder).not.toHaveBeenCalled();
      },
    );

    it("returns 409 idempotency_key_mismatch when the key was used for another cart", async () => {
      mockedOrderService.createOrder.mockRejectedValue(
        new ConflictException("idempotency_key_mismatch"),
      );

      const response = await POST(makeRequest(body));

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        success: false,
        message: "idempotency_key_mismatch",
      });
    });
  });

  describe("request body validation", () => {
    it("returns 400 validation_error when items is missing", async () => {
      const response = await POST(makeRequest({}));

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        success: false,
        message: "validation_error",
        details: { items: expect.any(Array) },
      });
      expect(mockedOrderService.createOrder).not.toHaveBeenCalled();
    });

    it.each([
      { items: [] },
      { items: [{ menuItemId: "not-a-uuid", qty: 1 }] },
      { items: [{ menuItemId: ITEM_ID, qty: 0 }] },
      { items: [{ menuItemId: ITEM_ID, qty: 1.5 }] },
      { items: [{ menuItemId: ITEM_ID, qty: 100 }] },
      { items: [{ menuItemId: ITEM_ID, qty: 1, priceUSD: "0.01" }] },
      { ...body, businessId: "other" },
    ])("returns 400 validation_error for %j", async (payload) => {
      const response = await POST(makeRequest(payload));

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        success: false,
        message: "validation_error",
      });
      expect(mockedOrderService.createOrder).not.toHaveBeenCalled();
    });

    it("returns 400 invalid_json when the body is malformed JSON", async () => {
      const response = await POST(makeRequest(null, { invalidJson: true }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ success: false, message: "invalid_json" });
      expect(mockedOrderService.createOrder).not.toHaveBeenCalled();
    });
  });

  describe("failed domain check", () => {
    it.each([
      [new ConflictException("table_session_closed"), 409, "table_session_closed"],
      [new HttpException(400, "menu_item_not_found"), 400, "menu_item_not_found"],
      [new ConflictException("menu_item_archived"), 409, "menu_item_archived"],
      [new ConflictException("menu_item_sold_out"), 409, "menu_item_sold_out"],
    ])("returns the service's error", async (error, status, message) => {
      mockedOrderService.createOrder.mockRejectedValue(error);

      const response = await POST(makeRequest(body));

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ success: false, message });
    });
  });

  describe("server errors", () => {
    it("returns 500 database_error when the database fails", async () => {
      mockedOrderService.createOrder.mockRejectedValue(
        new DBException("Error creating order", new Error("database unavailable")),
      );

      const response = await POST(makeRequest(body));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ success: false, message: "database_error" });
    });
  });
});
