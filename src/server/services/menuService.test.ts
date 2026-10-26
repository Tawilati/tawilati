import { describe, expect, it } from "vitest";
import { Prisma } from "@/src/app/generated/prisma/client";
import { AppError } from "@/src/server/errors";
import type {
  MenuCategoryRecord,
  MenuItemRecord,
  MenuRepository,
  TableWithBusiness,
} from "@/src/server/repositories/menuRepository";
import { createMenuService } from "./menuService";

const TOKEN = "a".repeat(64);

function table(overrides: Partial<TableWithBusiness> = {}): TableWithBusiness {
  return {
    id: 3,
    label: "T3",
    slug: "t3",
    isDisabled: false,
    business: { id: 1, name: "Café Hamra", slug: "cafe-hamra" },
    ...overrides,
  };
}

function item(overrides: Partial<MenuItemRecord> = {}): MenuItemRecord {
  return {
    id: 10,
    name: "Espresso",
    priceUSD: new Prisma.Decimal("2.5"),
    priceLBP: new Prisma.Decimal("223750"),
    soldOut: false,
    archivedAt: null,
    ...overrides,
  };
}

function fakeRepo(
  tableRecord: TableWithBusiness | null,
  categories: MenuCategoryRecord[] = [],
): MenuRepository & { menuRequestedFor: number[] } {
  const menuRequestedFor: number[] = [];
  return {
    menuRequestedFor,
    async findTableByQrToken(qrToken) {
      return qrToken === TOKEN ? tableRecord : null;
    },
    async findMenuCategories(businessId) {
      menuRequestedFor.push(businessId);
      return categories;
    },
  };
}

async function expectAppError(promise: Promise<unknown>, status: number, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ status, code });
}

describe("menuService.getPublicMenu", () => {
  it("returns the business, the table and the menu with prices as strings", async () => {
    const service = createMenuService(
      fakeRepo(table(), [{ id: 1, name: "Hot drinks", items: [item()] }]),
    );

    const menu = await service.getPublicMenu({ businessSlug: "cafe-hamra", qrToken: TOKEN });

    expect(menu).toEqual({
      business: { id: 1, name: "Café Hamra", slug: "cafe-hamra" },
      table: { id: 3, label: "T3", slug: "t3" },
      categories: [
        {
          id: 1,
          name: "Hot drinks",
          items: [
            { id: 10, name: "Espresso", priceUSD: "2.50", priceLBP: "223750", soldOut: false },
          ],
        },
      ],
    });
  });

  it("keeps sold-out items but marks them", async () => {
    const service = createMenuService(
      fakeRepo(table(), [{ id: 1, name: "Hot drinks", items: [item({ soldOut: true })] }]),
    );

    const menu = await service.getPublicMenu({ businessSlug: "cafe-hamra", qrToken: TOKEN });

    expect(menu.categories[0].items[0].soldOut).toBe(true);
  });

  it("hides archived items and categories left empty", async () => {
    const service = createMenuService(
      fakeRepo(table(), [
        {
          id: 1,
          name: "Hot drinks",
          items: [item({ id: 10 }), item({ id: 11, archivedAt: new Date() })],
        },
        { id: 2, name: "Seasonal", items: [item({ id: 12, archivedAt: new Date() })] },
        { id: 3, name: "Empty", items: [] },
      ]),
    );

    const menu = await service.getPublicMenu({ businessSlug: "cafe-hamra", qrToken: TOKEN });

    expect(menu.categories.map((c) => c.id)).toEqual([1]);
    expect(menu.categories[0].items.map((i) => i.id)).toEqual([10]);
  });

  it("rejects an unknown QR token with invalid_qr", async () => {
    const service = createMenuService(fakeRepo(table()));

    await expectAppError(
      service.getPublicMenu({ businessSlug: "cafe-hamra", qrToken: "b".repeat(64) }),
      404,
      "invalid_qr",
    );
  });

  it("rejects a token that belongs to another business, without loading any menu", async () => {
    const repo = fakeRepo(table({ business: { id: 2, name: "Other café", slug: "other-cafe" } }));
    const service = createMenuService(repo);

    await expectAppError(service.getPublicMenu({ businessSlug: "cafe-hamra", qrToken: TOKEN }), 404, "invalid_qr");
    expect(repo.menuRequestedFor).toEqual([]);
  });

  it("rejects a disabled table with table_disabled", async () => {
    const service = createMenuService(fakeRepo(table({ isDisabled: true })));

    await expectAppError(
      service.getPublicMenu({ businessSlug: "cafe-hamra", qrToken: TOKEN }),
      409,
      "table_disabled",
    );
  });
});
