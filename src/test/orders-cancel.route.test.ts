import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/orders/[id]/cancel/route";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";

const mockedOrderService = vi.hoisted(() => ({
  cancelGuestOrder: vi.fn(),
}));

vi.mock("@/service/OrderService", () => ({
  orderService: mockedOrderService,
}));

const GUEST_TOKEN = "b".repeat(64);
const ORDER_ID = "f0000000-0000-4000-8000-000000000001";
const cancelledOrder = { orderId: ORDER_ID, status: "CANCELLED" };

function makeRequest(authorization?: string): NextRequest {
  const headers = new Headers();
  if (authorization) headers.set("authorization", authorization);

  return new NextRequest(`http://localhost/api/orders/${ORDER_ID}/cancel`, {
    method: "POST",
    headers,
  });
}

function makeContext(id = ORDER_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedOrderService.cancelGuestOrder.mockResolvedValue(cancelledOrder);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/orders/:id/cancel", () => {
  it("cancels the guest order and returns the service result", async () => {
    const response = await POST(makeRequest(`Bearer ${GUEST_TOKEN}`), makeContext());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "order cancelled",
      data: cancelledOrder,
    });
    expect(mockedOrderService.cancelGuestOrder).toHaveBeenCalledWith(ORDER_ID, GUEST_TOKEN);
  });

  it.each([undefined, "Basic credentials", "Bearer   "])(
    "returns 401 unauthorized for missing or invalid guest authorization",
    async (authorization) => {
      const response = await POST(makeRequest(authorization), makeContext());

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        success: false,
        message: "unauthorized",
      });
      expect(mockedOrderService.cancelGuestOrder).not.toHaveBeenCalled();
    },
  );

  it("returns the service error when the order cannot be cancelled", async () => {
    mockedOrderService.cancelGuestOrder.mockRejectedValue(
      new ConflictException("cannot_cancel_order_already_in_progress"),
    );

    const response = await POST(makeRequest(`Bearer ${GUEST_TOKEN}`), makeContext());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      message: "cannot_cancel_order_already_in_progress",
    });
    expect(mockedOrderService.cancelGuestOrder).toHaveBeenCalledWith(ORDER_ID, GUEST_TOKEN);
  });
});
