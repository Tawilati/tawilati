
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DBException } from "@/utils/exceptions/RepoException";

const tableSelect = {
  id: true,
  label: true,
  slug: true,
  isDisabled: true,
  createdAt: true,
  updatedAt:true,
} as const;

export class TableRepo {
  private static instance: TableRepo;

  static getInstance(): TableRepo {
    if (!TableRepo.instance) {
      TableRepo.instance = new TableRepo();
    }
    return TableRepo.instance;
  }
  async findByLabelInBusiness(label: string, businessId: string) {
  try {
    return await prisma.diningTable.findFirst({
      where: {
        businessId,
        label,
      },
      select: tableSelect,
    });
  } catch (err) {
    throw new DBException("Error checking table label", err as Error);
  }
}

  async listByBusiness(businessId: string) {
    try {
      return await prisma.diningTable.findMany({
        where: { businessId },
        orderBy: [{ createdAt: "asc" }, { label: "asc" }],
        select: tableSelect,
      });
    } catch (err) {
      throw new DBException("Error listing tables", err as Error);
    }
  }
  async findInBusiness(id: string, businessId: string) {
    try {
      return await prisma.diningTable.findFirst({
        where: { id, businessId },
        select: tableSelect,
      });
    } catch (err) {
      throw new DBException("Error loading table", err as Error);
    }
  }

  async update(
    id: string,
    businessId: string,
    data: { label?: string; isDisabled?: boolean },
  ) {
    try {
      return await prisma.diningTable.update({
        where: { id, businessId },
        data,
        select: tableSelect,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === "P2025" || err.code === "P2002")
      ) {
        throw err;
      }

      throw new DBException("Error updating table", err as Error);
    }
  }

  async create(data: {
    businessId: string;
    label: string;
    slug: string;
    qrToken: string;
  }) {
    try {
      return await prisma.diningTable.create({
        data,
        select: tableSelect,
      });
    } catch (err) {
      // Let Prisma's unique-constraint error reach handleRouteError,
      // which converts P2002 into HTTP 409.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw err;
      }

      throw new DBException("Error creating table", err as Error);
    }
  }
}

export const tableRepo = TableRepo.getInstance();
