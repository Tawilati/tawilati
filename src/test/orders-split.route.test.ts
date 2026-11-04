import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/orders/split/route";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { HttpException } from "@/utils/exceptions/http/HttpException";

const mockedOrderService = vi.hoisted(() => ({
  splitBill: vi.fn(),
}));

vi.mock("@/service/OrderService", () => ({
  orderService: mockedOrderService,
}));

vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const GUEST_TOKEN = "b".repeat(64);

const splitResult = {
  sessionId: "c0000000-0000-4000-8000-000000000001",
  tableLabel: "T1",
  totalUSD: "24.50",
  totalLBP: "220000.00",
  splitCount: 4,
  perPersonUSD: "6.13",
  perPersonLBP: "55000.00",
};

function makeRequest(
  body?: unknown,
  { token = GUEST_TOKEN, invalidJson = false }: { token?: string | null; invalidJson?: boolean } = {},
): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== null) headers.authorization = `Bearer ${token}`;

  return new NextRequest("http://localhost/api/orders/split", {
    method: "POST",
    headers,
    body: invalidJson ? "{ not json" : JSON.stringify(body ?? {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedOrderService.splitBill.mockResolvedValue(splitResult);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/orders/split", () => {
  it("returns the bill split for the authenticated guest", async () => {
    const response = await POST(makeRequest({ splitCount: 4 }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "bill split",
      data: splitResult,
    });
    expect(mockedOrderService.splitBill).toHaveBeenCalledWith(GUEST_TOKEN, 4);
  });

  it("returns 401 unauthorized when the guest token is missing", async () => {
    const response = await POST(makeRequest({ splitCount: 4 }, { token: null }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      message: "unauthorized",
    });
    expect(mockedOrderService.splitBill).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { splitCount: 0 },
    { splitCount: 51 },
    { splitCount: 1.5 },
    { splitCount: "4" },
  ])("returns 400 validation_error for %j", async (payload) => {
    const response = await POST(makeRequest(payload));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "validation_error",
    });
    expect(mockedOrderService.splitBill).not.toHaveBeenCalled();
  });

  it("returns 400 invalid_json when the body is malformed JSON", async () => {
    const response = await POST(makeRequest(undefined, { invalidJson: true }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: "invalid_json",
    });
    expect(mockedOrderService.splitBill).not.toHaveBeenCalled();
  });

  it("returns 400 invalid_split_count when the service rejects the split count", async () => {
    mockedOrderService.splitBill.mockRejectedValue(new BadRequestException("invalid_split_count"));

    const response = await POST(makeRequest({ splitCount: 2 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: "invalid_split_count",
    });
  });

  it("returns 409 table_session_closed when the tab is closed", async () => {
    mockedOrderService.splitBill.mockRejectedValue(new ConflictException("table_session_closed"));

    const response = await POST(makeRequest({ splitCount: 2 }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      message: "table_session_closed",
    });
  });

  it("returns 401 guest_session_revoked when the guest session has been revoked", async () => {
    mockedOrderService.splitBill.mockRejectedValue(new HttpException(401, "guest_session_revoked"));

    const response = await POST(makeRequest({ splitCount: 3 }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      message: "guest_session_revoked",
    });
  });
});
