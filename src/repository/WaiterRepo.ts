import prisma from "@/lib/db";
import { DbClient } from "@/types/Db";
import type { WaiterBillRecord, WaiterTableRecord } from "@/types/Waiter";

import { DBException } from "@/utils/exceptions/RepoException";
import { Prisma } from "@/app/generated/prisma/client";


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
;

// Add to WaiterRepo

async findOrderForWaiter(orderId: string, businessId: string) {
  try {
    return await prisma.diningOrder.findFirst({
      where: { id: orderId, businessId },
      select: { id: true, status: true },
    });
  } catch (error) {
    throw new DBException(
      "Error finding order for waiter",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

async markOrderAsServed(orderId: string, tx: DbClient = prisma) {
  try {
    return await tx.diningOrder.update({
      where: { id: orderId },
      data: { status: "SERVED" },
    });
  } catch (error) {
    throw new DBException(
      "Error marking order as served",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
async findBillBySessionId(
  sessionId: string,
  businessId: string,
): Promise<WaiterBillRecord | null> {
  try {
    return await prisma.tableSession.findFirst({
      where: { id: sessionId, businessId }, // Scoped to business
      include: {
        table: { select: { label: true } },
        orders: {
             where: { status: { in: ["READY", "SERVED"] } },
          include: {
            orderLines: {
              include: { menuItem: { select: { name: true } } },
            },
          },
          orderBy: { createdAt: "asc" }, // Oldest first (chronological)
        },
      },
    });
  } catch (error) {
    throw new DBException(
      "Error finding bill",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

// Add to WaiterRepo

async findSessionForClose(sessionId: string, businessId: string) {
  try {
    return await prisma.tableSession.findFirst({
      where: { id: sessionId, businessId },
      select: {
        id: true,
        status: true,
        totalUSD: true,
        totalLBP: true,
        amountPaidUSD: true,
        amountPaidLBP: true,
      },
    });
  } catch (error) {
    throw new DBException(
      "Error finding session for close",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

async recordPaymentAndClose(
  data: {
    sessionId: string;
        paymentUSD: Prisma.Decimal;
    paymentLBP: Prisma.Decimal;
    method: "CASH" | "EXTERNAL_CARD";
    recordedById: string;
  },
  tx: DbClient = prisma,
) {
  try {
    // 1. Insert Payment
    const payment = await tx.payment.create({
      data: {
        sessionId: data.sessionId,
        amountUSD: data.paymentUSD,
        amountLBP: data.paymentLBP,
        method: data.method,
        recordedById: data.recordedById,
      },
    });

    // 2. Update TableSession (paid = bill total, status = CLOSED)
    const session = await tx.tableSession.update({
      where: { id: data.sessionId },
      data: {
        amountPaidUSD: data.paymentUSD,
        amountPaidLBP: data.paymentLBP,
        status: "CLOSED",
        closedAt: new Date(),
        activeTableId: null,
      },
    });

    // 3. Revoke all GuestSessions
    await tx.guestSession.updateMany({
      where: { sessionId: data.sessionId },
      data: { revokedAt: new Date() },
    });

    return { payment, session };
  } catch (error) {
    throw new DBException(
      "Error recording payment and closing tab",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}



}

export const waiterRepo = WaiterRepo.getInstance();