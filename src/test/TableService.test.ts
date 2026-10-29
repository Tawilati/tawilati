import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";

const { tableRepo } = vi.hoisted(() => ({
  tableRepo: { findStickerInBusiness: vi.fn(), findByLabelInBusiness: vi.fn(), create: vi.fn() },
}));
vi.mock("@/repository/TableRepo", () => ({ tableRepo }));
const { uniqueTableSlug } = vi.hoisted(() => ({ uniqueTableSlug: vi.fn() }));
vi.mock("@/service/SlugService", () => ({ slugService: { uniqueTableSlug } }));

import { tableService } from "@/service/TableService";

beforeEach(() => vi.resetAllMocks());

function uniqueError(meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002", clientVersion: "7.10.1", meta,
  });
}

describe("TableService.createTable", () => {
  const record = { id: "table-1", label: "T 1", slug: "t-1-2", isDisabled: false, createdAt: new Date() };

  beforeEach(() => {
    tableRepo.findByLabelInBusiness.mockResolvedValue(null);
    uniqueTableSlug.mockResolvedValueOnce("t-1").mockResolvedValue("t-1-2");
  });

  it.each([
    { target: ["businessId", "slug"] },
    { target: "DiningTable_businessId_slug_key" },
    { driverAdapterError: { cause: { constraint: { index: "DiningTable_businessId_slug_key" } } } },
  ])("reallocates the slug after a concurrent insert (%j)", async (meta) => {
    tableRepo.create.mockRejectedValueOnce(uniqueError(meta)).mockResolvedValueOnce(record);

    await expect(tableService.createTable("business-1", { label: " T 1 " })).resolves.toEqual(record);
    expect(tableRepo.create.mock.calls.map(([data]) => data.slug)).toEqual(["t-1", "t-1-2"]);
    expect(uniqueTableSlug).toHaveBeenNthCalledWith(2, "business-1", "t-1");
    expect(tableRepo.create.mock.calls[1][0].qrToken).toBe(tableRepo.create.mock.calls[0][0].qrToken);
  });

  it("bounds repeated slug collisions", async () => {
    tableRepo.create.mockRejectedValue(uniqueError({ target: ["businessId", "slug"] }));
    await expect(tableService.createTable("business-1", { label: "T 1" })).rejects.toMatchObject({ status: 409, message: "slug_already_taken" });
    expect(tableRepo.create).toHaveBeenCalledTimes(5);
  });

  it.each([
    uniqueError({ target: ["businessId", "label"] }),
    uniqueError({ target: ["qrToken"] }),
    uniqueError({}),
    new Error("Database unavailable"),
  ])("does not retry unrelated insert failures (%s)", async (error) => {
    tableRepo.create.mockRejectedValue(error);
    await expect(tableService.createTable("business-1", { label: "T 1" })).rejects.toBe(error);
    expect(tableRepo.create).toHaveBeenCalledTimes(1);
  });

  it("rejects an existing label before allocating a slug", async () => {
    tableRepo.findByLabelInBusiness.mockResolvedValue(record);
    await expect(tableService.createTable("business-1", { label: "T 1" })).rejects.toMatchObject({ status: 409, message: "table_label_exists" });
    expect(tableRepo.create).not.toHaveBeenCalled();
    expect(uniqueTableSlug).not.toHaveBeenCalled();
  });
});

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
