import prisma from "@/lib/db";
import type { WaiterTableRecord } from "@/types/Waiter";
import { DBException } from "@/utils/exceptions/RepoException";

export class WaiterRepo {
  private static instance: WaiterRepo;

  private constructor() {}

  static getInstance(): WaiterRepo {
    if (!WaiterRepo.instance) {
      WaiterRepo.instance = new WaiterRepo();
    }
    return WaiterRepo.instance;
  }

 async findActiveTables(businessId: string): Promise<WaiterTableRecord[]> {
  return await prisma.tableSession.findMany({
    where: { businessId, status: "OPEN" },
    include: {
      table: { select: { label: true } },
      _count: { select: { orders: true } },
      orders: {
        where: { status: "READY" },
        include: {                      
          orderLines: {
            include: {                   
              menuItem: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { openedAt: "asc" },
  });
}
}

export const waiterRepo = WaiterRepo.getInstance();