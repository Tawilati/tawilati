import { beforeEach, describe, expect, it, vi } from "vitest";

const { tableRepo } = vi.hoisted(() => ({
  tableRepo: { findStickerInBusiness: vi.fn() },
}));
vi.mock("@/repository/TableRepo", () => ({ tableRepo }));

import { tableService } from "@/service/TableService";

beforeEach(() => vi.clearAllMocks());

describe("TableService.getSticker", () => {
  it("builds the menu link from the business and table slugs and the QR token", async () => {
    tableRepo.findStickerInBusiness.mockResolvedValue({
      label: "T1",
      slug: "t1",
      qrToken: "a".repeat(64),
      business: { name: "Tawilati Demo Café", slug: "tawilati-demo-cafe" },
    });

    await expect(tableService.getSticker("business-1", "table-1")).resolves.toEqual({
      label: "T1",
      businessName: "Tawilati Demo Café",
      menuPath: `/menu/tawilati-demo-cafe/t1?t=${"a".repeat(64)}`,
    });
    expect(tableRepo.findStickerInBusiness).toHaveBeenCalledWith("table-1", "business-1");
  });

  it("answers not_found for a table that is not in this business", async () => {
    tableRepo.findStickerInBusiness.mockResolvedValue(null);

    await expect(tableService.getSticker("business-1", "table-1")).rejects.toMatchObject({
      status: 404,
      message: "not_found",
    });
  });
});
