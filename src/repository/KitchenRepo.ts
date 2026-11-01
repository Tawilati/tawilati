import prisma from "@/lib/db";
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

 async findKitchenOrders(businessId: string): Promise<KitchenOrderRecord[]> {
  try {
    return await prisma.diningOrder.findMany({
      where: {
        businessId,
        status: { in: ["NEW", "PREPARING"] },
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
}

export const kitchenRepo = KitchenRepo.getInstance();