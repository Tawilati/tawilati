import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { PERMISSION } from "@/types/Roles";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

const mocks = vi.hoisted(() => ({
  authGuard: vi.fn(),
  getBusinessIdFromRequest: vi.fn(),
  getSticker: vi.fn(),
  renderTableSticker: vi.fn(),
}));

vi.mock("@/lib/auth/gaurd", () => ({ authGuard: mocks.authGuard }));
vi.mock("@/lib/auth/requestHelper", () => ({ getBusinessIdFromRequest: mocks.getBusinessIdFromRequest }));
vi.mock("@/service/TableService", () => ({ tableService: { getSticker: mocks.getSticker } }));
vi.mock("@/lib/tableSticker", () => ({ renderTableSticker: mocks.renderTableSticker }));

import { GET } from "@/app/api/tables/[id]/qr/route";

const businessId = "business-1";
const tableId = "33333333-3333-4333-8333-333333333333";
const sticker = { label: "T1", businessName: "Demo Café", menuPath: "/menu/demo-cafe/t1?t=abc" };

function get(id = tableId) {
  return GET(new NextRequest(`http://localhost:3000/api/tables/${id}/qr`), { params: Promise.resolve({ id }) });
}

describe("GET /api/tables/:id/qr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authGuard.mockReturnValue(null);
    mocks.getBusinessIdFromRequest.mockReturnValue(businessId);
    mocks.getSticker.mockResolvedValue(sticker);
    mocks.renderTableSticker.mockImplementation(
      async () => new Response("png", { headers: { "content-type": "image/png" } }),
    );
  });

  afterEach(() => vi.unstubAllEnvs());

  it("answers the sticker PNG for the signed-in owner's table, never cached as-is", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-cache");
    expect(mocks.authGuard).toHaveBeenCalledWith(expect.anything(), { requirePermission: PERMISSION.TABLE_QR_READ });
    expect(mocks.getSticker).toHaveBeenCalledWith(businessId, tableId);
  });

  it("puts the full menu address in the code, on the address the request came in on", async () => {
    await get();

    expect(mocks.renderTableSticker).toHaveBeenCalledWith(sticker, "http://localhost:3000/menu/demo-cafe/t1?t=abc");
  });

  it("uses NEXT_PUBLIC_APP_URL when it is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://tawilati.app");

    await get();

    expect(mocks.renderTableSticker).toHaveBeenCalledWith(sticker, "https://tawilati.app/menu/demo-cafe/t1?t=abc");
  });

  it("returns the guard's refusal (a waiter) without loading the table", async () => {
    mocks.authGuard.mockReturnValue(NextResponse.json({ success: false, message: "forbidden" }, { status: 403 }));

    const response = await get();

    expect(response.status).toBe(403);
    expect(mocks.getSticker).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a UUID", async () => {
    const response = await get("not-a-uuid");

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("validation_error");
    expect(mocks.getSticker).not.toHaveBeenCalled();
  });

  it("answers 404 for a table of another business", async () => {
    mocks.getSticker.mockRejectedValue(new NotFoundException("not_found"));

    const response = await get();

    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe("not_found");
  });
});
