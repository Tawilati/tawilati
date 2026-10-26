import type { Prisma } from "@/src/app/generated/prisma/client";
import { prisma } from "@/src/lib/db";

export type TableWithBusiness = {
  id: number;
  label: string;
  slug: string;
  isDisabled: boolean;
  business: { id: number; name: string; slug: string };
};

export type MenuItemRecord = {
  id: number;
  name: string;
  priceUSD: Prisma.Decimal;
  priceLBP: Prisma.Decimal;
  soldOut: boolean;
  archivedAt: Date | null;
};

export type MenuCategoryRecord = {
  id: number;
  name: string;
  items: MenuItemRecord[];
};

export interface MenuRepository {
  findTableByQrToken(qrToken: string): Promise<TableWithBusiness | null>;
  // Every category of the business with all its items, archived included; the service decides what guests see.
  findMenuCategories(businessId: number): Promise<MenuCategoryRecord[]>;
}

const itemSelect = {
  id: true,
  name: true,
  priceUSD: true,
  priceLBP: true,
  soldOut: true,
  archivedAt: true,
} as const;

export const menuRepository: MenuRepository = {
  findTableByQrToken(qrToken) {
    return prisma.diningTable.findUnique({
      where: { qrToken },
      select: {
        id: true,
        label: true,
        slug: true,
        isDisabled: true,
        business: { select: { id: true, name: true, slug: true } },
      },
    });
  },

  findMenuCategories(businessId) {
    return prisma.menuCategory.findMany({
      where: { businessId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        items: {
          where: { businessId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: itemSelect,
        },
      },
    });
  },
};
