
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { PERMISSION } from "@/types/Roles";

const mocks = vi.hoisted(() => ({
  authGuard: vi.fn(),
  getBusinessIdFromRequest: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth/gaurd", () => ({
  authGuard: mocks.authGuard,
}));

vi.mock("@/lib/auth/requestHelper", () => ({
  getBusinessIdFromRequest: mocks.getBusinessIdFromRequest,
}));

vi.mock("@/lib/http", () => ({
  handle: async (callback: () => Promise<unknown>) => callback(),
}));

vi.mock("@/service/MenuItemsService", () => ({
  menuItemService: {
    update: mocks.update,
  },
}));

import { PATCH } from "@/app/api/menu-items/[id]/route";

const businessId = "business-1";
const itemId = "22222222-2222-4222-8222-222222222222";

function request(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/menu-items/${itemId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("PATCH /api/menu-items/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authGuard.mockReturnValue(null);
    mocks.getBusinessIdFromRequest.mockReturnValue(businessId);
  });

  it("updates a menu item and returns it", async () => {
    const input = { name: "Iced Coffee" };
    const updatedItem = { id: itemId, ...input };

    mocks.update.mockResolvedValue(updatedItem);

    const response = await PATCH(request(input), {
      params: Promise.resolve({ id: itemId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.menuItem).toEqual(updatedItem);
    expect(mocks.update).toHaveBeenCalledWith(
      businessId,
      itemId,
      input,
    );
    expect(mocks.authGuard).toHaveBeenCalledWith(
      expect.anything(),
      { requirePermission: PERMISSION.MENU_ITEM_WRITE },
    );
  });

  it("rejects an empty update", async () => {
    await expect(
      PATCH(request({}), {
        params: Promise.resolve({ id: itemId }),
      }),
    ).rejects.toBeDefined();

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects invalid update data", async () => {
    await expect(
      PATCH(request({ priceUSD: -10 }), {
        params: Promise.resolve({ id: itemId }),
      }),
    ).rejects.toBeDefined();

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not update when access is denied", async () => {
    mocks.authGuard.mockReturnValue(
      NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    );

    const response = await PATCH(request({ name: "Iced Coffee" }), {
      params: Promise.resolve({ id: itemId }),
    });

    expect(response.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a missing business context", async () => {
    mocks.getBusinessIdFromRequest.mockReturnValue(null);

    await expect(
      PATCH(request({ name: "Iced Coffee" }), {
        params: Promise.resolve({ id: itemId }),
      }),
    ).rejects.toThrow("missing_business_context");

    expect(mocks.update).not.toHaveBeenCalled();
  });
});
