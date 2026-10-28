// src/test/MenuService.test.ts
import { describe, expect, it, beforeEach, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import type {
  MenuCategoryRecord,
  MenuItemRecord,
  TableWithBusiness,
} from "@/repository/MenuRepo";
import { HttpException } from "@/utils/exceptions/http/HttpException";
import { MenuService } from "@/service/MenuService";

// ── Mock the repo module ─────────────────────────────────────
// The service imports `menuRepo` directly from this module.
// We replace it with mocked functions.
vi.mock("@/repository/MenuRepo", () => ({
  menuRepo: {
    findTableByQrToken: vi.fn(),
    findMenuCategories: vi.fn(),
  },
}));

import { menuRepo } from "@/repository/MenuRepo";

const mockedRepo = menuRepo as unknown as {
  findTableByQrToken: ReturnType<typeof vi.fn>;
  findMenuCategories: ReturnType<typeof vi.fn>;
};

// ── Fixtures ──────────────────────────────────────────────────
const TOKEN = "a".repeat(64);

function table(overrides: Partial<TableWithBusiness> = {}): TableWithBusiness {
  return {
    id: "table-3",
    label: "T3",
    slug: "t3",
    isDisabled: false,
    business: { id: "biz-1", name: "Café Hamra", slug: "cafe-hamra" },
    ...overrides,
  };
}

function item(overrides: Partial<MenuItemRecord> = {}): MenuItemRecord {
  return {
    id: "item-10",
    name: "Espresso",
    priceUSD: new Prisma.Decimal("2.5"),
    priceLBP: new Prisma.Decimal("223750"),
    soldOut: false,
    archivedAt: null,
    ...overrides,
  };
}

async function expectHttpError(promise: Promise<unknown>, status: number, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  expect(error).toMatchObject({ status, message: code });
}

const query = { businessSlug: "cafe-hamra", qrToken: TOKEN };

// ── Tests ─────────────────────────────────────────────────────
describe("MenuService.getPublicMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the business, the table and the menu with prices as strings", async () => {
    mockedRepo.findTableByQrToken.mockResolvedValue(table());
    mockedRepo.findMenuCategories.mockResolvedValue([
      { id: "cat-1", name: "Hot drinks", items: [item()] },
    ]);

    const service = new MenuService();
    const menu = await service.getPublicMenu(query);

    expect(menu).toEqual({
      business: { id: "biz-1", name: "Café Hamra", slug: "cafe-hamra" },
      table: { id: "table-3", label: "T3", slug: "t3" },
      categories: [
        {
          id: "cat-1",
          name: "Hot drinks",
          items: [
            { id: "item-10", name: "Espresso", priceUSD: "2.50", priceLBP: "223750", soldOut: false },
          ],
        },
      ],
    });
  });

  it("loads the menu of the table's business", async () => {
    mockedRepo.findTableByQrToken.mockResolvedValue(table());
    mockedRepo.findMenuCategories.mockResolvedValue([]);

    await new MenuService().getPublicMenu(query);

    expect(mockedRepo.findMenuCategories).toHaveBeenCalledWith("biz-1");
  });

  it("keeps sold-out items but marks them", async () => {
    mockedRepo.findTableByQrToken.mockResolvedValue(table());
    mockedRepo.findMenuCategories.mockResolvedValue([
      { id: "cat-1", name: "Hot drinks", items: [item({ soldOut: true })] },
    ]);

    const menu = await new MenuService().getPublicMenu(query);

    expect(menu.categories[0].items[0].soldOut).toBe(true);
  });

  it("hides archived items and categories left empty", async () => {
    mockedRepo.findTableByQrToken.mockResolvedValue(table());
    mockedRepo.findMenuCategories.mockResolvedValue([
      {
        id: "cat-1",
        name: "Hot drinks",
        items: [item({ id: "item-10" }), item({ id: "item-11", archivedAt: new Date() })],
      },
      { id: "cat-2", name: "Seasonal", items: [item({ id: "item-12", archivedAt: new Date() })] },
      { id: "cat-3", name: "Empty", items: [] },
    ]);

    const menu = await new MenuService().getPublicMenu(query);

    expect(menu.categories.map((c) => c.id)).toEqual(["cat-1"]);
    expect(menu.categories[0].items.map((i) => i.id)).toEqual(["item-10"]);
  });

  it("rejects an unknown QR token with invalid_qr", async () => {
    mockedRepo.findTableByQrToken.mockResolvedValue(null);

    await expectHttpError(
      new MenuService().getPublicMenu({ ...query, qrToken: "b".repeat(64) }),
      404,
      "invalid_qr",
    );
  });

  it("rejects a token that belongs to another business, without loading any menu", async () => {
    mockedRepo.findTableByQrToken.mockResolvedValue(
      table({ business: { id: "biz-2", name: "Other café", slug: "other-cafe" } }),
    );

    await expectHttpError(new MenuService().getPublicMenu(query), 404, "invalid_qr");
    expect(mockedRepo.findMenuCategories).not.toHaveBeenCalled();
  });

  it("rejects a disabled table with table_disabled", async () => {
    mockedRepo.findTableByQrToken.mockResolvedValue(table({ isDisabled: true }));

    await expectHttpError(new MenuService().getPublicMenu(query), 409, "table_disabled");
  });
});