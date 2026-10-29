import { prisma } from "@/lib/db";
import type { MenuCategoryRecord, TableWithBusiness } from "@/types/Menu";
import { DBException } from "@/utils/exceptions/RepoException";

const itemSelect = {
  id: true,
  name: true,
  priceUSD: true,
  priceLBP: true,
  soldOut: true,
  archivedAt: true,
} as const;

export class MenuRepo {
  private static instance: MenuRepo;

  //Prevents other files from creating instances with `new`.
  private constructor() {}

  static getInstance(): MenuRepo {
    if (!MenuRepo.instance) {
      MenuRepo.instance = new MenuRepo();
    }
    return MenuRepo.instance;
  }

  async findTableByQrToken(qrToken: string): Promise<TableWithBusiness | null> {
    try {
      return await prisma.diningTable.findUnique({
        where: { qrToken },
        select: {
          id: true,
          label: true,
          slug: true,
          isDisabled: true,
          business: { select: { id: true, name: true, slug: true } },
        },
      });
    } catch (err) {
      throw new DBException("Error loading table by QR token", err as Error);
    }
  }

  async findMenuCategories(businessId: string): Promise<MenuCategoryRecord[]> {
    try {
      // Creation order; rows created in the same instant (seed, bulk insert) fall back to name, since ids are random UUIDs.
      return await prisma.menuCategory.findMany({
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
    } catch (err) {
      throw new DBException("Error loading menu", err as Error);
    }
  }
}

export const menuRepo = MenuRepo.getInstance();
