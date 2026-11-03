import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { PATCH } from "@/app/api/waiter/order/[id]/served/route";
import { PERMISSION } from "@/types/Roles";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

const mocks = vi.hoisted(() => ({
  authGuard: vi.fn(),
  getBusinessIdFromRequest: vi.fn(),
  markOrderServed: vi.fn(),
}));

vi.mock("@/lib/auth/gaurd", () => ({ authGuard: mocks.authGuard }));
vi.mock("@/lib/auth/requestHelper", () => ({
  getBusinessIdFromRequest: mocks.getBusinessIdFromRequest,
}));
vi.mock("@/service/WaiterService", () => ({
  waiterService: { markOrderServed: mocks.markOrderServed },
}));

vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";
const ORDER_ID = "d0000000-0000-4000-8000-000000000010";

type Role = "OWNER" | "WAITER" | "KITCHEN";

function makeRequest(as: Role | null = "WAITER"): NextRequest {
  const headers = new Headers();
  if (as) {
    headers.set("x-user-id", "u0000000-0000-4000-8000-000000000009");
    headers.set("x-user-role", as);
    headers.set("x-business-id", BUSINESS_ID);
  }

  return new NextRequest(`http://localhost/api/waiter/order/${ORDER_ID}/served`, {
    method: "PATCH",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authGuard.mockReturnValue(null);
  mocks.getBusinessIdFromRequest.mockReturnValue(BUSINESS_ID);
  mocks.markOrderServed.mockResolvedValue({ orderId: ORDER_ID, status: "SERVED" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("PATCH /api/waiter/order/:id/served", () => {
  it("marks the ready order as served for the signed-in business", async () => {
    const response = await PATCH(makeRequest("WAITER"), {
      params: Promise.resolve({ id: ORDER_ID }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "order marked as served",
      data: { orderId: ORDER_ID, status: "SERVED" },
    });
    expect(mocks.authGuard).toHaveBeenCalledWith(expect.anything(), {
      requirePermission: PERMISSION.ORDER_STATUS_SERVED,
    });
    expect(mocks.markOrderServed).toHaveBeenCalledWith(ORDER_ID, BUSINESS_ID);
  });

  it("returns 401 when nobody is signed in", async () => {
    mocks.authGuard.mockReturnValue(
      NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 }),
    );

    const response = await PATCH(makeRequest(null), {
      params: Promise.resolve({ id: ORDER_ID }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      message: "unauthorized",
    });
    expect(mocks.markOrderServed).not.toHaveBeenCalled();
  });

  it("returns 403 when the requester lacks the waiter permission", async () => {
    mocks.authGuard.mockReturnValue(
      NextResponse.json({ success: false, message: "forbidden" }, { status: 403 }),
    );

    const response = await PATCH(makeRequest("KITCHEN"), {
      params: Promise.resolve({ id: ORDER_ID }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: "forbidden",
    });
    expect(mocks.markOrderServed).not.toHaveBeenCalled();
  });

  it("returns a not-found error when the order belongs to another business", async () => {
    mocks.markOrderServed.mockRejectedValue(new NotFoundException("not_found"));

    const response = await PATCH(makeRequest("OWNER"), {
      params: Promise.resolve({ id: ORDER_ID }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      message: "not_found",
    });
  });

  it("answers 400 validation_error for an id that isn't a UUID, before the service", async () => {
    const response = await PATCH(makeRequest("WAITER"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("validation_error");
    expect(mocks.markOrderServed).not.toHaveBeenCalled();
  });
});
