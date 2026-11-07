import type { OrderStatus } from "@/app/generated/prisma/client";
import prisma from "@/lib/db";
import { DbClient } from "@/types/Db";
import type { KitchenOrderRecord } from "@/types/Kitchen";
import { DBException } from "@/utils/exceptions/RepoException";

export class KitchenRepo {
  private static instance: KitchenRepo;

  private constructor() {}

  static getInstance(): KitchenRepo {
    if (!KitchenRepo.instance) {
      KitchenRepo.instance = new KitchenRepo();
    }

    return KitchenRepo.instance;
  }

 // Rounds still to cook, plus those the guest cancelled since `cancelledSince` (shown crossed out for a while).
 async findKitchenOrders(businessId: string, cancelledSince: Date): Promise<KitchenOrderRecord[]> {
  try {
    return await prisma.diningOrder.findMany({
      where: {
        businessId,
        OR: [
          { status: { in: ["NEW", "PREPARING"] } },
          { status: "CANCELLED", cancelledAt: { gte: cancelledSince } },
        ],
      },
      include: {
        table: { select: { label: true } },
        session: { select: { status: true } },
        orderLines: {
          include: {
            menuItem: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" }, // Oldest first (FIFO for the kitchen)
    });
  } catch (error) {
    throw new DBException(
      "Error finding kitchen orders",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
async findOrderForKitchen(orderId: string, businessId: string) {
  try {
    return await prisma.diningOrder.findFirst({
      where: { id: orderId, businessId },
      select: { id: true, status: true },
    });
  } catch (error) {
    throw new DBException(
      "Error finding order for kitchen",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

// Moves the round only if it is still `from`; false when something else changed it first (a guest's cancel,
// another kitchen screen), so the caller can say which.
async updateOrderStatus(
  orderId: string,
  from: OrderStatus,
  to: "PREPARING" | "READY",
  tx: DbClient = prisma,
): Promise<boolean> {
  try {
    const { count } = await tx.diningOrder.updateMany({
      where: { id: orderId, status: from },
      data: { status: to },
    });
    return count === 1;
  } catch (error) {
    throw new DBException(
      "Error updating order status",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
}
export const kitchenRepo = KitchenRepo.getInstance();