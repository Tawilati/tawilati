import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/db";
import type { DbClient } from "@/types/Db";
import { DBException } from "@/utils/exceptions/RepoException";

export type CreateOrderData = {
  businessId: string;
  sessionId: string;
  tableId: string;
  guestSessionId: string;
  totalUSD: Prisma.Decimal;
  totalLBP: Prisma.Decimal;
  lines: {
    menuItemId: string;
    qty: number;
    priceUSD: Prisma.Decimal;
    priceLBP: Prisma.Decimal;
    rateSnapshot: Prisma.Decimal;
  }[];
};

export type OrderWithRelations = Prisma.DiningOrderGetPayload<{
  include: {
    table: {
      select: { label: true };
    };
    orderLines: {
      include: {
        menuItem: {
          select: { name: true };
        };
      };
    };
  };
}>;


export class OrderRepo {
  private static instance: OrderRepo;

  private constructor() {}

  static getInstance(): OrderRepo {
    if (!OrderRepo.instance) {
      OrderRepo.instance = new OrderRepo();
    }

    return OrderRepo.instance;
  }
   async findByIdWithRelations(
    orderId: string,
  ): Promise<OrderWithRelations | null> {
    try {
      return await prisma.diningOrder.findUnique({
        where: { id: orderId },
        include: {
          table: {
            select: { label: true },
          },
          orderLines: {
            include: {
              menuItem: {
                select: { name: true },
              },
            },
          },
        },
      });
    } catch (error) {
      throw new DBException(
        "Error finding order with relations",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async create(
    data: CreateOrderData,
    tx: DbClient = prisma,
  ): Promise<OrderWithRelations> {
    try {
      return await tx.diningOrder.create({
        data: {
          business: { connect: { id: data.businessId } },
          session: { connect: { id: data.sessionId } },
          table: { connect: { id: data.tableId } },
          guestSession: { connect: { id: data.guestSessionId } },
          totalUSD: data.totalUSD,
          totalLBP: data.totalLBP,
          orderLines: {
            create: data.lines.map((line) => ({
              menuItemId: line.menuItemId,
              qty: line.qty,
              priceUSD: line.priceUSD,
              priceLBP: line.priceLBP,
              rateSnapshot: line.rateSnapshot,
            })),
          },
        },
        include: {
          table: {
            select: { label: true },
          },
          orderLines: {
            include: {
              menuItem: {
                select: { name: true },
              },
            },
          },
        },
      });
    } catch (error) {
      throw new DBException(
        "Error creating order",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}

export const orderRepo = OrderRepo.getInstance();