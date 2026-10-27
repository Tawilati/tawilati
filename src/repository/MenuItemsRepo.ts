
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";

export type MenuItemRecord = {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  priceUSD: Prisma.Decimal;
  priceLBP: Prisma.Decimal;
  soldOut: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateMenuItemData = {
  categoryId: string;
  name: string;
  priceUSD: Prisma.Decimal;
  priceLBP: Prisma.Decimal;
  soldOut?: boolean;
};

export type UpdateMenuItemData = {
  categoryId?: string;
  name?: string;
  priceUSD?: Prisma.Decimal;
  priceLBP?: Prisma.Decimal;
  soldOut?: boolean;
};

export interface MenuItemRepository {
  findManyByBusiness(businessId: string): Promise<MenuItemRecord[]>;
  findById(itemId: string, businessId: string): Promise<MenuItemRecord | null>;
  findBusinessExchangeRate(businessId: string): Promise<Prisma.Decimal | null>;
  categoryBelongsToBusiness(categoryId: string, businessId: string): Promise<boolean>;
  create(businessId: string, data: CreateMenuItemData): Promise<MenuItemRecord>;
  update(itemId: string, businessId: string, data: UpdateMenuItemData): Promise<MenuItemRecord | null>;
  setArchived(itemId: string, businessId: string, archivedAt: Date | null): Promise<MenuItemRecord | null>;
}

const menuItemSelect = {
  id: true,
  businessId: true,
  categoryId: true,
  name: true,
  priceUSD: true,
  priceLBP: true,
  soldOut: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class MenuItemRepo implements MenuItemRepository {
  private static instance: MenuItemRepo;

  static getInstance(): MenuItemRepo {
    if (!MenuItemRepo.instance) {
      MenuItemRepo.instance = new MenuItemRepo();
    }
    return MenuItemRepo.instance;
  }

  async findManyByBusiness(businessId: string): Promise<MenuItemRecord[]> {
    return prisma.menuItem.findMany({
      where: { businessId },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      select: menuItemSelect,
    });
  }

  async findById(
    itemId: string,
    businessId: string,
  ): Promise<MenuItemRecord | null> {
    return prisma.menuItem.findFirst({
      where: { id: itemId, businessId },
      select: menuItemSelect,
    });
  }

  async findBusinessExchangeRate(
    businessId: string,
  ): Promise<Prisma.Decimal | null> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { exchangeRate: true },
    });

    return business?.exchangeRate ?? null;
  }

  async categoryBelongsToBusiness(
    categoryId: string,
    businessId: string,
  ): Promise<boolean> {
    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, businessId },
      select: { id: true },
    });

    return category !== null;
  }

  async create(
    businessId: string,
    data: CreateMenuItemData,
  ): Promise<MenuItemRecord> {
    return prisma.menuItem.create({
      data: {
        businessId,
        categoryId: data.categoryId,
        name: data.name,
        priceUSD: data.priceUSD,
        priceLBP: data.priceLBP,
        ...(data.soldOut === undefined ? {} : { soldOut: data.soldOut }),
      },
      select: menuItemSelect,
    });
  }

  async update(
    itemId: string,
    businessId: string,
    data: UpdateMenuItemData,
  ): Promise<MenuItemRecord | null> {
    const updated = await prisma.menuItem.updateManyAndReturn({
      where: { id: itemId, businessId },
      data,
      select: menuItemSelect,
    });

    return updated[0] ?? null;
  }

  async setArchived(
    itemId: string,
    businessId: string,
    archivedAt: Date | null,
  ): Promise<MenuItemRecord | null> {
    const updated = await prisma.menuItem.updateManyAndReturn({
      where: { id: itemId, businessId },
      data: { archivedAt },
      select: menuItemSelect,
    });

    return updated[0] ?? null;
  }
}

export const menuItemRepo = MenuItemRepo.getInstance();
