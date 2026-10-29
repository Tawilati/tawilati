import type { Prisma } from "@/app/generated/prisma/client";

// What the menu repository returns.
export type TableWithBusiness = {
  id: string;
  label: string;
  slug: string;
  isDisabled: boolean;
  business: { id: string; name: string; slug: string };
};

export type PublicMenuItemRecord = {
  id: string;
  name: string;
  priceUSD: Prisma.Decimal;
  priceLBP: Prisma.Decimal;
  soldOut: boolean;
  archivedAt: Date | null;
};

// Every category of the business with all its items, archived included; the mapper decides what guests see.
export type MenuCategoryRecord = {
  id: string;
  name: string;
  items: PublicMenuItemRecord[];
};

// What GET /api/menu sends back.
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

// Archived items are hidden from guests, and a category left with no items is dropped.
export function mapToPublicMenu(
  table: TableWithBusiness,
  categories: MenuCategoryRecord[],
): PublicMenu {
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
