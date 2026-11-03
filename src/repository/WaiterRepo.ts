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
// Every round on the tab except cancelled ones, so the lines add up to the tab's totals.
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
          where: { status: { not: "CANCELLED" } },
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

// Closes the tab only while it is still OPEN; false when it was already closed (or isn't this business's).
// The update locks the row, so of two closes racing on one tab only the first gets true.
async closeIfOpen(
  data: {
    sessionId: string;
    businessId: string;
    amountPaidUSD: Prisma.Decimal;
    amountPaidLBP: Prisma.Decimal;
  },
  tx: DbClient = prisma,
): Promise<boolean> {
  try {
    const { count } = await tx.tableSession.updateMany({
      where: { id: data.sessionId, businessId: data.businessId, status: "OPEN" },
      data: {
        amountPaidUSD: data.amountPaidUSD,
        amountPaidLBP: data.amountPaidLBP,
        status: "CLOSED",
        closedAt: new Date(),
        activeTableId: null,
      },
    });
    return count === 1;
  } catch (error) {
    throw new DBException(
      "Error closing tab",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

// Rounds the kitchen or the waiter still has to finish (NEW, PREPARING, READY).
async countUnservedOrders(sessionId: string, tx: DbClient = prisma): Promise<number> {
  try {
    return await tx.diningOrder.count({
      where: { sessionId, status: { in: ["NEW", "PREPARING", "READY"] } },
    });
  } catch (error) {
    throw new DBException(
      "Error counting unserved orders",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

async createPayment(
  data: {
    sessionId: string;
    amountUSD: Prisma.Decimal;
    amountLBP: Prisma.Decimal;
    method: "CASH" | "EXTERNAL_CARD";
    recordedById: string;
  },
  tx: DbClient = prisma,
) {
  try {
    return await tx.payment.create({ data });
  } catch (error) {
    throw new DBException(
      "Error recording payment",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

// Ends every phone's access to the tab.
async revokeGuestSessions(sessionId: string, tx: DbClient = prisma): Promise<void> {
  try {
    await tx.guestSession.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch (error) {
    throw new DBException(
      "Error revoking guest sessions",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
}

export const waiterRepo = WaiterRepo.getInstance();
