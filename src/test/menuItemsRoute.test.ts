
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { PERMISSION } from "@/types/Roles";

const mocks = vi.hoisted(() => ({
  authGuard: vi.fn(),
  getBusinessIdFromRequest: vi.fn(),
  getAll: vi.fn(),
  create: vi.fn(),
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
    getAll: mocks.getAll,
    create: mocks.create,
  },
}));

import { GET, POST } from "@/app/api/menu-items/route";

const businessId = "business-1";
const item = {
  id: "item-1",
  name: "Coffee",
  categoryId: "11111111-1111-4111-8111-111111111111",
  priceUSD: "2.00",
  soldOut: false,
};

function request(
  method: string,
  body?: unknown,
): NextRequest {
  return new NextRequest("http://localhost/api/menu-items", {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
}

describe("/api/menu-items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authGuard.mockReturnValue(null);
    mocks.getBusinessIdFromRequest.mockReturnValue(businessId);
  });

  describe("GET", () => {
    it("returns menu items for the current business", async () => {
      mocks.getAll.mockResolvedValue([item]);

      const response = await GET(request("GET"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.menuItems).toEqual([item]);
      expect(mocks.getAll).toHaveBeenCalledWith(businessId);
      expect(mocks.authGuard).toHaveBeenCalledWith(
        expect.anything(),
        { requirePermission: PERMISSION.MENU_ITEM_READ },
      );
    });

    it("returns the auth response when access is denied", async () => {
      const denied = NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 },
      );
      mocks.authGuard.mockReturnValue(denied);

      const response = await GET(request("GET"));

      expect(response.status).toBe(401);
      expect(mocks.getAll).not.toHaveBeenCalled();
    });

    it("rejects a missing business context", async () => {
      mocks.getBusinessIdFromRequest.mockReturnValue(null);

      await expect(GET(request("GET"))).rejects.toThrow(
        "missing_business_context",
      );
      expect(mocks.getAll).not.toHaveBeenCalled();
    });
  });

  describe("POST", () => {
    const validInput = {
      name: "Coffee",
      categoryId: "11111111-1111-4111-8111-111111111111",
      priceUSD: 2,
    };

    it("creates a menu item and returns 201", async () => {
      mocks.create.mockResolvedValue(item);

      const response = await POST(request("POST", validInput));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.menuItem).toEqual(item);
      expect(mocks.create).toHaveBeenCalledWith(
        businessId,
        validInput,
      );
      expect(mocks.authGuard).toHaveBeenCalledWith(
        expect.anything(),
        { requirePermission: PERMISSION.MENU_ITEM_WRITE },
      );
    });

    it("rejects invalid input without creating an item", async () => {
      const responsePromise = POST(
        request("POST", { name: "", categoryId: "invalid", priceUSD: -1 }),
      );

      await expect(responsePromise).rejects.toBeDefined();
      expect(mocks.create).not.toHaveBeenCalled();
    });

    it("does not create an item when access is denied", async () => {
      mocks.authGuard.mockReturnValue(
        NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
      );

      const response = await POST(request("POST", validInput));

      expect(response.status).toBe(401);
      expect(mocks.create).not.toHaveBeenCalled();
    });
  });
});
