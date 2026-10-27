import { describe, expect, it } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import type {
  MenuCategoryRecord,
  MenuItemRecord,
  MenuRepository,
  TableWithBusiness,
} from "@/repository/MenuRepo";
import { HttpException } from "@/utils/exceptions/http/HttpException";
import { MenuService } from "@/service/MenuService";

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

function fakeRepo(
  tableRecord: TableWithBusiness | null,
  categories: MenuCategoryRecord[] = [],
): MenuRepository & { menuRequestedFor: string[] } {
  const menuRequestedFor: string[] = [];
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

async function expectHttpError(promise: Promise<unknown>, status: number, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  expect(error).toMatchObject({ status, message: code });
}

const query = { businessSlug: "cafe-hamra", qrToken: TOKEN };

describe("MenuService.getPublicMenu", () => {
  it("returns the business, the table and the menu with prices as strings", async () => {
    const service = new MenuService(
      fakeRepo(table(), [{ id: "cat-1", name: "Hot drinks", items: [item()] }]),
    );

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
    const repo = fakeRepo(table());
    await new MenuService(repo).getPublicMenu(query);

    expect(repo.menuRequestedFor).toEqual(["biz-1"]);
  });

  it("keeps sold-out items but marks them", async () => {
    const service = new MenuService(
      fakeRepo(table(), [{ id: "cat-1", name: "Hot drinks", items: [item({ soldOut: true })] }]),
    );

    const menu = await service.getPublicMenu(query);

    expect(menu.categories[0].items[0].soldOut).toBe(true);
  });

  it("hides archived items and categories left empty", async () => {
    const service = new MenuService(
      fakeRepo(table(), [
        {
          id: "cat-1",
          name: "Hot drinks",
          items: [item({ id: "item-10" }), item({ id: "item-11", archivedAt: new Date() })],
        },
        { id: "cat-2", name: "Seasonal", items: [item({ id: "item-12", archivedAt: new Date() })] },
        { id: "cat-3", name: "Empty", items: [] },
      ]),
    );

    const menu = await service.getPublicMenu(query);

    expect(menu.categories.map((c) => c.id)).toEqual(["cat-1"]);
    expect(menu.categories[0].items.map((i) => i.id)).toEqual(["item-10"]);
  });

  it("rejects an unknown QR token with invalid_qr", async () => {
    const service = new MenuService(fakeRepo(table()));

    await expectHttpError(
      service.getPublicMenu({ ...query, qrToken: "b".repeat(64) }),
      404,
      "invalid_qr",
    );
  });

  it("rejects a token that belongs to another business, without loading any menu", async () => {
    const repo = fakeRepo(table({ business: { id: "biz-2", name: "Other café", slug: "other-cafe" } }));
    const service = new MenuService(repo);

    await expectHttpError(service.getPublicMenu(query), 404, "invalid_qr");
    expect(repo.menuRequestedFor).toEqual([]);
  });

  it("rejects a disabled table with table_disabled", async () => {
    const service = new MenuService(fakeRepo(table({ isDisabled: true })));

    await expectHttpError(service.getPublicMenu(query), 409, "table_disabled");
  });
});
