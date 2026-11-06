import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { PERMISSION } from "@/types/Roles";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

const mocks = vi.hoisted(() => ({
  authGuard: vi.fn(),
  getBusinessIdFromRequest: vi.fn(),
  setSoldOut: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/gaurd", () => ({
  authGuard: mocks.authGuard,
}));

vi.mock("@/lib/auth/requestHelper", () => ({
  getBusinessIdFromRequest: mocks.getBusinessIdFromRequest,
}));

vi.mock("@/service/MenuItemsService", () => ({
  menuItemService: {
    setSoldOut: mocks.setSoldOut,
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { PATCH } from "@/app/api/menu-items/[id]/soldout/route";

const BUSINESS_ID = "business-1";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";

function request(body: unknown, invalidJson = false): NextRequest {
  return new NextRequest(`http://localhost/api/menu-items/${ITEM_ID}/sold-out`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: invalidJson ? "{ not json" : JSON.stringify(body),
  });
}

function context(id = ITEM_ID) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/menu-items/:id/sold-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authGuard.mockReturnValue(null);
    mocks.getBusinessIdFromRequest.mockReturnValue(BUSINESS_ID);
    mocks.setSoldOut.mockImplementation(async (id: string, _businessId: string, soldOut: boolean) => ({
      id,
      soldOut,
    }));
  });

  it.each([
    [true, "item marked as sold out"],
    [false, "item marked as available"],
  ])("sets soldOut to %s, responds, and invalidates the guest menu", async (soldOut, message) => {
    const response = await PATCH(request({ soldOut }), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message,
      data: { id: ITEM_ID, soldOut },
    });
    expect(mocks.authGuard).toHaveBeenCalledWith(
      expect.anything(),
      { requirePermission: PERMISSION.SOLD_OUT_TOGGLE },
    );
    expect(mocks.setSoldOut).toHaveBeenCalledWith(ITEM_ID, BUSINESS_ID, soldOut);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/menu/[business]/[table]", "page");
  });

  it("returns the auth response and skips the service when access is denied", async () => {
    const denied = NextResponse.json(
      { success: false, message: "forbidden" },
      { status: 403 },
    );
    mocks.authGuard.mockReturnValue(denied);

    const response = await PATCH(request({ soldOut: true }), context());

    expect(response.status).toBe(403);
    expect(mocks.setSoldOut).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns 400 validation_error for an invalid item id", async () => {
    const response = await PATCH(request({ soldOut: true }), context("not-a-uuid"));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "validation_error",
      details: { id: expect.any(Array) },
    });
    expect(mocks.setSoldOut).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([{}, { soldOut: "true" }, { soldOut: 1 }])(
    "returns 400 validation_error for invalid request body %j",
    async (body) => {
      const response = await PATCH(request(body), context());

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        success: false,
        message: "validation_error",
      });
      expect(mocks.setSoldOut).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("returns 400 invalid_json when the body is malformed", async () => {
    const response = await PATCH(request({}, true), context());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: "invalid_json",
    });
    expect(mocks.setSoldOut).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a service error without invalidating the menu", async () => {
    mocks.setSoldOut.mockRejectedValue(new NotFoundException("menu_item_not_found"));

    const response = await PATCH(request({ soldOut: true }), context());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      message: "menu_item_not_found",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
