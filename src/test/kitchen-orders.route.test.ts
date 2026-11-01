import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/kitchen/orders/route";
import { PATCH } from "@/app/api/kitchen/[id]/route";
import { DBException } from "@/utils/exceptions/RepoException";

const mockedKitchenService = vi.hoisted(() => ({
  getKitchenOrders: vi.fn(),
  updateKitchenOrderStatus: vi.fn(),
}));

vi.mock("@/service/KitchenService", () => ({
  kitchenService: mockedKitchenService,
}));

vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";
const ORDER_ID = "d0000000-0000-4000-8000-000000000010";

type Role = "OWNER" | "WAITER" | "KITCHEN";

function makeRequest(as: Role | null = "KITCHEN"): NextRequest {
  const headers = new Headers();
  if (as) {
    headers.set("x-user-id", "u0000000-0000-4000-8000-000000000009");
    headers.set("x-user-role", as);
    headers.set("x-business-id", BUSINESS_ID);
  }

  return new NextRequest("http://localhost/api/kitchen/orders", {
    method: "GET",
    headers,
  });
}

function makePatchRequest(
  body: unknown,
  as: Role | null = "KITCHEN",
  invalidJson = false,
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (as) {
    headers.set("x-user-id", "u0000000-0000-4000-8000-000000000009");
    headers.set("x-user-role", as);
    headers.set("x-business-id", BUSINESS_ID);
  }

  return new NextRequest(`http://localhost/api/kitchen/${ORDER_ID}`, {
    method: "PATCH",
    headers,
    body: invalidJson ? "{ not json" : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedKitchenService.getKitchenOrders.mockResolvedValue([]);
  mockedKitchenService.updateKitchenOrderStatus.mockResolvedValue({
    orderId: ORDER_ID,
    status: "PREPARING",
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/kitchen/orders", () => {
  describe("successful", () => {
    it("returns the kitchen orders for the authenticated business", async () => {
      const orders = [{ orderId: "order-1", status: "NEW" }];
      mockedKitchenService.getKitchenOrders.mockResolvedValue(orders);

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        message: "kitchen orders",
        data: orders,
      });
      expect(mockedKitchenService.getKitchenOrders).toHaveBeenCalledWith(BUSINESS_ID);
    });

    it("allows an owner with the kitchen queue permission", async () => {
      const response = await GET(makeRequest("OWNER"));

      expect(response.status).toBe(200);
      expect(mockedKitchenService.getKitchenOrders).toHaveBeenCalledWith(BUSINESS_ID);
    });
  });

  describe("failed domain check", () => {
    it("returns 401 when the request has no authenticated user", async () => {
      const response = await GET(makeRequest(null));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        success: false,
        message: "unauthorized",
      });
      expect(mockedKitchenService.getKitchenOrders).not.toHaveBeenCalled();
    });

    it("returns 403 when a waiter lacks permission", async () => {
      const response = await GET(makeRequest("WAITER"));

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        success: false,
        message: "forbidden",
      });
      expect(mockedKitchenService.getKitchenOrders).not.toHaveBeenCalled();
    });
  });

  describe("server errors", () => {
    it("returns 500 database_error when the kitchen orders cannot be loaded", async () => {
      mockedKitchenService.getKitchenOrders.mockRejectedValue(
        new DBException("read failed", new Error("database unavailable")),
      );

      const response = await GET(makeRequest());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        message: "database_error",
      });
    });
  });
});

describe("PATCH /api/kitchen/:id", () => {
  describe("successful updates", () => {
    it("marks an order as preparing for the current business", async () => {
      const result = { orderId: ORDER_ID, status: "PREPARING" };
      mockedKitchenService.updateKitchenOrderStatus.mockResolvedValue(result);

      const response = await PATCH(makePatchRequest({ status: "PREPARING" }), {
        params: Promise.resolve({ id: ORDER_ID }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        message: "order marked as preparing",
        data: result,
      });
      expect(mockedKitchenService.updateKitchenOrderStatus).toHaveBeenCalledWith(
        ORDER_ID,
        BUSINESS_ID,
        "PREPARING",
      );
    });

    it("allows an owner with kitchen write permission", async () => {
      const response = await PATCH(makePatchRequest({ status: "READY" }, "OWNER"), {
        params: Promise.resolve({ id: ORDER_ID }),
      });

      expect(response.status).toBe(200);
      expect(mockedKitchenService.updateKitchenOrderStatus).toHaveBeenCalledWith(
        ORDER_ID,
        BUSINESS_ID,
        "READY",
      );
    });
  });

  describe("request validation and auth", () => {
    it("returns 401 when nobody is signed in", async () => {
      const response = await PATCH(makePatchRequest({ status: "PREPARING" }, null), {
        params: Promise.resolve({ id: ORDER_ID }),
      });

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        success: false,
        message: "unauthorized",
      });
      expect(mockedKitchenService.updateKitchenOrderStatus).not.toHaveBeenCalled();
    });

    it("returns 403 when a waiter lacks kitchen permission", async () => {
      const response = await PATCH(makePatchRequest({ status: "READY" }, "WAITER"), {
        params: Promise.resolve({ id: ORDER_ID }),
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        success: false,
        message: "forbidden",
      });
      expect(mockedKitchenService.updateKitchenOrderStatus).not.toHaveBeenCalled();
    });

    it("returns 400 validation_error when the status is invalid", async () => {
      const response = await PATCH(makePatchRequest({ status: "SERVED" }), {
        params: Promise.resolve({ id: ORDER_ID }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        success: false,
        message: "validation_error",
      });
      expect(mockedKitchenService.updateKitchenOrderStatus).not.toHaveBeenCalled();
    });

    it("returns 400 invalid_json when the body is not valid JSON", async () => {
      const response = await PATCH(makePatchRequest({}, "KITCHEN", true), {
        params: Promise.resolve({ id: ORDER_ID }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        message: "invalid_json",
      });
      expect(mockedKitchenService.updateKitchenOrderStatus).not.toHaveBeenCalled();
    });
  });
});
