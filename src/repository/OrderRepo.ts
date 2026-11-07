import { Prisma } from "@/app/generated/prisma/client";
import { Decimal } from "@/app/generated/prisma/internal/prismaNamespace";
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
 async findGuestOrderForCancel(orderId: string, guestSessionId: string) {
  try {
    return await prisma.diningOrder.findFirst({
      where: {
        id: orderId,
        guestSessionId, 
      },
      select: {
        id: true,
        status: true,
        sessionId: true,
        totalUSD: true,
        totalLBP: true,
      },
    });
  } catch (error) {
    throw new DBException(
      "Error finding guest order for cancel",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

// Cancels the round only if it is still NEW, then takes its amount off the tab. False (and nothing written)
// when the kitchen started it first. Run it inside the caller's transaction.
async cancelOrderAndUpdateBill(
  orderId: string,
  sessionId: string,
  totalUSD: Decimal,
  totalLBP: Decimal,
  tx: DbClient = prisma,
): Promise<boolean> {
  try {
    const { count } = await tx.diningOrder.updateMany({
      where: { id: orderId, status: "NEW" },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (count === 0) return false;

    await tx.tableSession.update({
      where: { id: sessionId },
      data: {
        totalUSD: { decrement: totalUSD },
        totalLBP: { decrement: totalLBP },
      },
    });
    return true;
  } catch (error) {
    throw new DBException(
      "Error cancelling order",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}


}

export const orderRepo = OrderRepo.getInstance();