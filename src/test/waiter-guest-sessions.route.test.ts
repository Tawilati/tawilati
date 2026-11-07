import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { PATCH as confirmGuestRoute } from "@/app/api/waiter/guest-sessions/[id]/confirm/route";
import { PATCH as rejectGuestRoute } from "@/app/api/waiter/guest-sessions/[id]/reject/route";
import { GET as pendingGuestsRoute } from "@/app/api/waiter/guest-sessions/pending/route";
import { PERMISSION } from "@/types/Roles";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

const mocks = vi.hoisted(() => ({
  authGuard: vi.fn(),
  getBusinessIdFromRequest: vi.fn(),
  getPendingGuests: vi.fn(),
  confirmGuest: vi.fn(),
  rejectGuest: vi.fn(),
}));

vi.mock("@/lib/auth/gaurd", () => ({ authGuard: mocks.authGuard }));
vi.mock("@/lib/auth/requestHelper", () => ({
  getBusinessIdFromRequest: mocks.getBusinessIdFromRequest,
}));
vi.mock("@/service/WaiterService", () => ({
  waiterService: {
    getPendingGuests: mocks.getPendingGuests,
    confirmGuest: mocks.confirmGuest,
    rejectGuest: mocks.rejectGuest,
  },
}));
vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";
const GUEST_SESSION_ID = "c0000000-0000-4000-8000-000000000010";
const pendingGuest = {
  guestSessionId: GUEST_SESSION_ID,
  tableLabel: "T1",
  createdAt: "2026-11-07T00:00:00.000Z",
  expiresAt: "2026-11-07T02:00:00.000Z",
};

function makeRequest(method: string, url = "http://localhost/api/waiter/guest-sessions") {
  return new NextRequest(url, { method });
}

function params(id = GUEST_SESSION_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authGuard.mockReturnValue(null);
  mocks.getBusinessIdFromRequest.mockReturnValue(BUSINESS_ID);
  mocks.getPendingGuests.mockResolvedValue([pendingGuest]);
  mocks.confirmGuest.mockResolvedValue({ id: GUEST_SESSION_ID, status: "ACTIVE" });
  mocks.rejectGuest.mockResolvedValue({ id: GUEST_SESSION_ID, status: "REJECTED" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/waiter/guest-sessions/pending", () => {
  it("returns pending guests for the signed-in business", async () => {
    const response = await pendingGuestsRoute(makeRequest("GET"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "pending guests",
      data: [pendingGuest],
    });
    expect(mocks.authGuard).toHaveBeenCalledWith(expect.anything(), {
      requirePermission: PERMISSION.WAITER_TABLES_READ,
    });
    expect(mocks.getPendingGuests).toHaveBeenCalledWith(BUSINESS_ID);
  });

  it("returns 401 and does not query guests when the requester is unauthenticated", async () => {
    mocks.authGuard.mockReturnValue(
      NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 }),
    );

    const response = await pendingGuestsRoute(makeRequest("GET"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, message: "unauthorized" });
    expect(mocks.getPendingGuests).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/waiter/guest-sessions/:id/confirm", () => {
  it("confirms the guest session for the signed-in business", async () => {
    const response = await confirmGuestRoute(makeRequest("PATCH"), params());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "guest confirmed",
      data: { guestSessionId: GUEST_SESSION_ID, status: "ACTIVE" },
    });
    expect(mocks.authGuard).toHaveBeenCalledWith(expect.anything(), {
      requirePermission: PERMISSION.WAITER_TABLES_READ,
    });
    expect(mocks.confirmGuest).toHaveBeenCalledWith(GUEST_SESSION_ID, BUSINESS_ID);
  });

  it("returns 403 and does not confirm the guest without waiter permission", async () => {
    mocks.authGuard.mockReturnValue(
      NextResponse.json({ success: false, message: "forbidden" }, { status: 403 }),
    );

    const response = await confirmGuestRoute(makeRequest("PATCH"), params());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, message: "forbidden" });
    expect(mocks.confirmGuest).not.toHaveBeenCalled();
  });

  it("passes through a conflict when the guest is no longer pending", async () => {
    mocks.confirmGuest.mockRejectedValue(new ConflictException("guest_not_pending"));

    const response = await confirmGuestRoute(makeRequest("PATCH"), params());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, message: "guest_not_pending" });
  });
});

describe("PATCH /api/waiter/guest-sessions/:id/reject", () => {
  it("rejects the guest session for the signed-in business", async () => {
    const response = await rejectGuestRoute(makeRequest("PATCH"), params());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "guest rejected",
      data: { guestSessionId: GUEST_SESSION_ID, status: "REJECTED" },
    });
    expect(mocks.authGuard).toHaveBeenCalledWith(expect.anything(), {
      requirePermission: PERMISSION.WAITER_TABLES_READ,
    });
    expect(mocks.rejectGuest).toHaveBeenCalledWith(GUEST_SESSION_ID, BUSINESS_ID);
  });

  it("passes through not-found when the guest session is outside the business", async () => {
    mocks.rejectGuest.mockRejectedValue(new NotFoundException("guest_not_found"));

    const response = await rejectGuestRoute(makeRequest("PATCH"), params());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, message: "guest_not_found" });
  });
});
