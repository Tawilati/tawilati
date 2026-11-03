import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET as billRoute } from "@/app/api/waiter/order/[id]/bill/route";
import { POST as closeRoute } from "@/app/api/waiter/order/[id]/close/route";
import { PATCH as kitchenStatusRoute } from "@/app/api/kitchen/[id]/route";
import { PERMISSION } from "@/types/Roles";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";

const mocks = vi.hoisted(() => ({
  authGuard: vi.fn(),
  getBusinessIdFromRequest: vi.fn(),
  getUserIdFromRequest: vi.fn(),
  getBill: vi.fn(),
  closeTab: vi.fn(),
  updateKitchenOrderStatus: vi.fn(),
}));

vi.mock("@/lib/auth/gaurd", () => ({ authGuard: mocks.authGuard }));
vi.mock("@/lib/auth/requestHelper", () => ({
  getBusinessIdFromRequest: mocks.getBusinessIdFromRequest,
  getUserIdFromRequest: mocks.getUserIdFromRequest,
}));
vi.mock("@/service/WaiterService", () => ({
  waiterService: { getBill: mocks.getBill, closeTab: mocks.closeTab },
}));
vi.mock("@/service/KitchenService", () => ({
  kitchenService: { updateKitchenOrderStatus: mocks.updateKitchenOrderStatus },
}));
vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";
const WAITER_ID = "a0000000-0000-4000-8000-000000000009";
const TAB_ID = "c0000000-0000-4000-8000-000000000010";

function request(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const payment = { amountReceivedUSD: 20, amountReceivedLBP: 0, method: "CASH" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authGuard.mockReturnValue(null);
  mocks.getBusinessIdFromRequest.mockReturnValue(BUSINESS_ID);
  mocks.getUserIdFromRequest.mockReturnValue(WAITER_ID);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/waiter/order/:id/bill", () => {
  it("returns the tab's bill for the signed-in business", async () => {
    mocks.getBill.mockResolvedValue({ sessionId: TAB_ID });

    const response = await billRoute(request("GET"), params(TAB_ID));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "table bill",
      data: { sessionId: TAB_ID },
    });
    expect(mocks.authGuard).toHaveBeenCalledWith(expect.anything(), {
      requirePermission: PERMISSION.BILL_READ,
    });
    expect(mocks.getBill).toHaveBeenCalledWith(TAB_ID, BUSINESS_ID);
  });

  it("answers 400 validation_error for an id that isn't a UUID", async () => {
    const response = await billRoute(request("GET"), params("t1"));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("validation_error");
    expect(mocks.getBill).not.toHaveBeenCalled();
  });
});

describe("POST /api/waiter/order/:id/close", () => {
  it("closes the tab with the waiter from the session as the payment's recorder", async () => {
    mocks.closeTab.mockResolvedValue({ sessionId: TAB_ID, status: "CLOSED" });

    const response = await closeRoute(request("POST", payment), params(TAB_ID));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ sessionId: TAB_ID, status: "CLOSED" });
    expect(mocks.authGuard).toHaveBeenCalledWith(expect.anything(), {
      requirePermission: PERMISSION.TAB_CLOSE,
    });
    expect(mocks.closeTab).toHaveBeenCalledWith(TAB_ID, BUSINESS_ID, WAITER_ID, payment);
  });

  it("answers 400 validation_error for an id that isn't a UUID", async () => {
    const response = await closeRoute(request("POST", payment), params("t1"));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("validation_error");
    expect(mocks.closeTab).not.toHaveBeenCalled();
  });

  it("answers 400 validation_error for a bad body", async () => {
    const response = await closeRoute(
      request("POST", { ...payment, method: "BITCOIN" }),
      params(TAB_ID),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("validation_error");
    expect(mocks.closeTab).not.toHaveBeenCalled();
  });

  it("passes the service's conflict through as the contract code", async () => {
    mocks.closeTab.mockRejectedValue(new ConflictException("tab_not_settleable"));

    const response = await closeRoute(request("POST", payment), params(TAB_ID));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, message: "tab_not_settleable" });
  });
});

describe("PATCH /api/kitchen/:id", () => {
  it("answers 400 validation_error for an id that isn't a UUID", async () => {
    const response = await kitchenStatusRoute(
      request("PATCH", { status: "PREPARING" }),
      params("order-1"),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("validation_error");
    expect(mocks.updateKitchenOrderStatus).not.toHaveBeenCalled();
  });

  it("passes a valid id to the service", async () => {
    mocks.updateKitchenOrderStatus.mockResolvedValue({ orderId: TAB_ID, status: "PREPARING" });

    const response = await kitchenStatusRoute(
      request("PATCH", { status: "PREPARING" }),
      params(TAB_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateKitchenOrderStatus).toHaveBeenCalledWith(TAB_ID, BUSINESS_ID, "PREPARING");
  });
});
