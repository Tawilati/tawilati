import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";

export type TableWithBusiness = {
  id: string;
  label: string;
  slug: string;
  isDisabled: boolean;
  business: { id: string; name: string; slug: string };
};

export type MenuItemRecord = {
  id: string;
  name: string;
  priceUSD: Prisma.Decimal;
  priceLBP: Prisma.Decimal;
  soldOut: boolean;
  archivedAt: Date | null;
};

export type MenuCategoryRecord = {
  id: string;
  name: string;
  items: MenuItemRecord[];
};

// What MenuService needs; tests pass a fake that implements it.
export interface MenuRepository {
  findTableByQrToken(qrToken: string): Promise<TableWithBusiness | null>;
  // Every category of the business with all its items, archived included; the service decides what guests see.
  findMenuCategories(businessId: string): Promise<MenuCategoryRecord[]>;
}

const itemSelect = {
  id: true,
  name: true,
  priceUSD: true,
  priceLBP: true,
  soldOut: true,
  archivedAt: true,
} as const;

export class MenuRepo implements MenuRepository {
  private static instance: MenuRepo;
  static getInstance(): MenuRepo {
    if (!MenuRepo.instance) {
      MenuRepo.instance = new MenuRepo();
    }
    return MenuRepo.instance;
  }

  findTableByQrToken(qrToken: string) {
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
  }

  findMenuCategories(businessId: string) {
    // Creation order; rows created in the same instant (seed, bulk insert) fall back to name, since ids are random UUIDs.
    return prisma.menuCategory.findMany({
      where: { businessId },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        items: {
          where: { businessId },
          orderBy: [{ createdAt: "asc" }, { name: "asc" }],
          select: itemSelect,
        },
      },
    });
  }
}

export const menuRepo = MenuRepo.getInstance();
