import { conflict, notFound } from "@/src/server/errors";
import type { MenuRepository } from "@/src/server/repositories/menuRepository";
import type { PublicMenuQuery } from "@/src/server/validation/menuSchemas";

export type PublicMenuItem = {
  id: number;
  name: string;
  priceUSD: string; // "2.50"
  priceLBP: string; // "223750"
  soldOut: boolean;
};

export type PublicMenu = {
  business: { id: number; name: string; slug: string };
  table: { id: number; label: string; slug: string };
  categories: { id: number; name: string; items: PublicMenuItem[] }[];
};

export function createMenuService(repo: MenuRepository) {
  return {
    // The menu a guest sees after scanning the QR code on a table.
    async getPublicMenu({ businessSlug, qrToken }: PublicMenuQuery): Promise<PublicMenu> {
      const table = await repo.findTableByQrToken(qrToken);
      // A token from another business gets the same answer as an unknown one.
      if (!table || table.business.slug !== businessSlug) throw notFound("invalid_qr");
      if (table.isDisabled) throw conflict("table_disabled");

      const categories = await repo.findMenuCategories(table.business.id);

      return {
        business: table.business,
        table: { id: table.id, label: table.label, slug: table.slug },
        categories: categories
          .map((category) => ({
            id: category.id,
            name: category.name,
            items: category.items
              .filter((item) => item.archivedAt === null)
              .map((item) => ({
                id: item.id,
                name: item.name,
                priceUSD: item.priceUSD.toFixed(2),
                priceLBP: item.priceLBP.toFixed(0),
                soldOut: item.soldOut,
              })),
          }))
          .filter((category) => category.items.length > 0),
      };
    },
  };
}

export type MenuService = ReturnType<typeof createMenuService>;
