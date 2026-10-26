// Type-only import: the service never loads Prisma, so unit tests run without a database.
import type { MenuRepository } from "@/repository/MenuRepo";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import type { PublicMenuQuery } from "@/validation/menuSchemas";

export type PublicMenuItem = {
  id: string;
  name: string;
  priceUSD: string; // "2.50"
  priceLBP: string; // "223750"
  soldOut: boolean;
};

export type PublicMenu = {
  business: { id: string; name: string; slug: string };
  table: { id: string; label: string; slug: string };
  categories: { id: string; name: string; items: PublicMenuItem[] }[];
};

export class MenuService {
  constructor(private readonly repo: MenuRepository) {}

  // The menu a guest sees after scanning the QR code on a table.
  async getPublicMenu({ businessSlug, qrToken }: PublicMenuQuery): Promise<PublicMenu> {
    const table = await this.repo.findTableByQrToken(qrToken);
    // A token from another business gets the same answer as an unknown one.
    if (!table || table.business.slug !== businessSlug) throw new NotFoundException("invalid_qr");
    if (table.isDisabled) throw new ConflictException("table_disabled");

    const categories = await this.repo.findMenuCategories(table.business.id);

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
  }
}
