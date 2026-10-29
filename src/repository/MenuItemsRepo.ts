
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { DbClient } from "@/types/Db";
import { DBException } from "@/utils/exceptions/RepoException";
import type {
  CreateMenuItemData,
  DeleteMenuItemResult,
  MenuItemRecord,
  UpdateMenuItemData,
} from "@/types/MenuItem";

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

export class MenuItemRepo {
  private static instance: MenuItemRepo;
  //Prevents creating repository instances with `new` outside this class.
  private constructor() {}

  static getInstance(): MenuItemRepo {
    if (!MenuItemRepo.instance) {
      MenuItemRepo.instance = new MenuItemRepo();
    }
    return MenuItemRepo.instance;
  }

  async findManyByBusiness(businessId: string): Promise<MenuItemRecord[]> {
    try {
      return await prisma.menuItem.findMany({
        where: { businessId },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }],
        select: menuItemSelect,
      });
    } catch (err) {
      throw new DBException("Error listing menu items", err as Error);
    }
  }

  async findById(
    itemId: string,
    businessId: string,
  ): Promise<MenuItemRecord | null> {
    try {
      return await prisma.menuItem.findFirst({
        where: { id: itemId, businessId },
        select: menuItemSelect,
      });
    } catch (err) {
      throw new DBException("Error loading menu item", err as Error);
    }
  }

  async findBusinessExchangeRate(
    businessId: string,
  ): Promise<Prisma.Decimal | null> {
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { exchangeRate: true },
      });

      return business?.exchangeRate ?? null;
    } catch (err) {
      throw new DBException("Error loading exchange rate", err as Error);
    }
  }

  async categoryBelongsToBusiness(
    categoryId: string,
    businessId: string,
  ): Promise<boolean> {
    try {
      const category = await prisma.menuCategory.findFirst({
        where: { id: categoryId, businessId },
        select: { id: true },
      });

      return category !== null;
    } catch (err) {
      throw new DBException("Error checking menu item category", err as Error);
    }
  }

  async create(
    businessId: string,
    data: CreateMenuItemData,
  ): Promise<MenuItemRecord> {
    try {
      return await prisma.menuItem.create({
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
    } catch (err) {
      throw new DBException("Error creating menu item", err as Error);
    }
  }

  async update(
    itemId: string,
    businessId: string,
    data: UpdateMenuItemData,
  ): Promise<MenuItemRecord | null> {
    try {
      const updated = await prisma.menuItem.updateManyAndReturn({
        where: { id: itemId, businessId },
        data,
        select: menuItemSelect,
      });

      return updated[0] ?? null;
    } catch (err) {
      throw new DBException("Error updating menu item", err as Error);
    }
  }

  async setArchived(
    itemId: string,
    businessId: string,
    archivedAt: Date | null,
  ): Promise<MenuItemRecord | null> {
    try {
      const updated = await prisma.menuItem.updateManyAndReturn({
        where: { id: itemId, businessId },
        data: { archivedAt },
        select: menuItemSelect,
      });

      return updated[0] ?? null;
    } catch (err) {
      throw new DBException("Error archiving menu item", err as Error);
    }
  }

  // The highest USD price in the business (archived items included), or null with no items.
  async findMaxPriceUSD(businessId: string): Promise<Prisma.Decimal | null> {
    try {
      const result = await prisma.menuItem.aggregate({
        where: { businessId },
        _max: { priceUSD: true },
      });
      return result._max.priceUSD;
    } catch (err) {
      throw new DBException("Error loading the highest menu price", err as Error);
    }
  }

  // Recomputes priceLBP = round(priceUSD x rate, 2) for every item of the business, archived ones too.
  // Raw SQL because Prisma's updateMany cannot set one column from another. Order lines keep their snapshots.
  async repriceLBP(tx: DbClient, businessId: string, exchangeRate: Prisma.Decimal): Promise<number> {
    try {
      return await tx.$executeRaw`
        UPDATE "MenuItem"
        SET "priceLBP" = ROUND("priceUSD" * ${exchangeRate.toString()}::numeric, 2),
            "updatedAt" = NOW()
        WHERE "businessId" = ${businessId}`;
    } catch (err) {
      throw new DBException("Error repricing menu items", err as Error);
    }
  }

  // "in_use": an order line points at the item, so only archiving is possible.
  async delete(
    itemId: string,
    businessId: string,
  ): Promise<DeleteMenuItemResult> {
    try {
      const { count } = await prisma.menuItem.deleteMany({
        where: { id: itemId, businessId },
      });
      return count > 0 ? "deleted" : "not_found";
    } catch (err) {
      // P2003: the foreign key from OrderLine (RESTRICT) refused the delete.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        return "in_use";
      }
      throw new DBException("Error deleting menu item", err as Error);
    }
  }
}

export const menuItemRepo = MenuItemRepo.getInstance();
