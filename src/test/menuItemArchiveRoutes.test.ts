
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { PERMISSION } from "@/types/Roles";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";

const mocks = vi.hoisted(() => ({
  authGuard: vi.fn(),
  getBusinessIdFromRequest: vi.fn(),
  archive: vi.fn(),
  unarchive: vi.fn(),
}));

vi.mock("@/lib/auth/gaurd", () => ({
  authGuard: mocks.authGuard,
}));

vi.mock("@/lib/auth/requestHelper", () => ({
  getBusinessIdFromRequest: mocks.getBusinessIdFromRequest,
}));

vi.mock("@/service/MenuItemsService", () => ({
  menuItemService: {
    archive: mocks.archive,
    unarchive: mocks.unarchive,
  },
}));

import { POST as archivePOST } from "@/app/api/menu-items/[id]/archive/route";
import { POST as unarchivePOST } from "@/app/api/menu-items/[id]/unarchive/route";

const businessId = "business-1";
const itemId = "22222222-2222-4222-8222-222222222222";

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
  });
}

const params = Promise.resolve({ id: itemId });

describe("POST /api/menu-items/:id/archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authGuard.mockReturnValue(null);
    mocks.getBusinessIdFromRequest.mockReturnValue(businessId);
  });

  it("archives the item and returns it", async () => {
    const archivedItem = { id: itemId, archivedAt: new Date() };
    mocks.archive.mockResolvedValue(archivedItem);

    const response = await archivePOST(
      request(`/api/menu-items/${itemId}/archive`),
      { params },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      ...archivedItem,
      archivedAt: archivedItem.archivedAt.toISOString(),
    });
    expect(mocks.archive).toHaveBeenCalledWith(businessId, itemId);
    expect(mocks.authGuard).toHaveBeenCalledWith(
      expect.anything(),
      { requirePermission: PERMISSION.MENU_ITEM_ARCHIVE },
    );
  });

  it("returns the service's 409 as the error shape", async () => {
    mocks.archive.mockRejectedValue(new ConflictException("menu_item_already_archived"));

    const response = await archivePOST(
      request(`/api/menu-items/${itemId}/archive`),
      { params },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, message: "menu_item_already_archived" });
  });

  it("does not archive when access is denied", async () => {
    mocks.authGuard.mockReturnValue(
      NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    );

    const response = await archivePOST(
      request(`/api/menu-items/${itemId}/archive`),
      { params },
    );

    expect(response.status).toBe(401);
    expect(mocks.archive).not.toHaveBeenCalled();
  });
});

describe("POST /api/menu-items/:id/unarchive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authGuard.mockReturnValue(null);
    mocks.getBusinessIdFromRequest.mockReturnValue(businessId);
  });

  it("restores the item and returns it", async () => {
    const restoredItem = { id: itemId, archivedAt: null };
    mocks.unarchive.mockResolvedValue(restoredItem);

    const response = await unarchivePOST(
      request(`/api/menu-items/${itemId}/unarchive`),
      { params },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(restoredItem);
    expect(mocks.unarchive).toHaveBeenCalledWith(businessId, itemId);
    expect(mocks.authGuard).toHaveBeenCalledWith(
      expect.anything(),
      { requirePermission: PERMISSION.MENU_ITEM_ARCHIVE },
    );
  });

  it("does not unarchive when access is denied", async () => {
    mocks.authGuard.mockReturnValue(
      NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    );

    const response = await unarchivePOST(
      request(`/api/menu-items/${itemId}/unarchive`),
      { params },
    );

    expect(response.status).toBe(401);
    expect(mocks.unarchive).not.toHaveBeenCalled();
  });
});
