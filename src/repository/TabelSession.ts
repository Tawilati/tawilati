import type { Prisma, TableSession } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { DbClient } from "@/types/Db";
import { DBException } from "@/utils/exceptions/RepoException";

export class TableSessionRepo {
  private static instance: TableSessionRepo;

  private constructor() {}

  static getInstance(): TableSessionRepo {
    if (!TableSessionRepo.instance) {
      TableSessionRepo.instance = new TableSessionRepo();
    }
    return TableSessionRepo.instance;
  }

  async create(
    businessId: string,
    tableId: string,
    tx: DbClient = prisma,
  ): Promise<TableSession> {
    try {
      return await tx.tableSession.create({
        data: {
          businessId,
          tableId,
          activeTableId: tableId,
        },
      });
    } catch (error: any) {
      // Let P2002 bubble up so the service can handle the race condition
      if (error.code === 'P2002') {
        throw error;
      }
      throw new DBException(
        "Error creating table session",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async getActiveByTableId(
    tableId: string,
    tx: DbClient = prisma,
  ): Promise<TableSession | null> {
    try {
      return await tx.tableSession.findUnique({
        where: { activeTableId: tableId }, // <--- Unique lookup, much faster
      });
    } catch (error) {
      throw new DBException(
        "Error finding active table session",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  // Adds a new round to the running bill
  async updateTotals(
    sessionId: string,
    totalUSD: Prisma.Decimal,
    totalLBP: Prisma.Decimal,
    tx: DbClient = prisma,
  ): Promise<TableSession> {
    try {
      return await tx.tableSession.update({
        where: { id: sessionId },
        data: {
          totalUSD: { increment: totalUSD },
          totalLBP: { increment: totalLBP },
        },
      });
    } catch (error) {
      throw new DBException(
        "Error updating table session totals",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  // For Waiter flow (G-05)
  async close(
    sessionId: string,
    tx: DbClient = prisma,
  ): Promise<TableSession> {
    try {
      return await tx.tableSession.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          activeTableId: null, // <--- Critical: frees the unique constraint
        },
      });
    } catch (error) {
      throw new DBException(
        "Error closing table session",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}

export const tableSessionRepo = TableSessionRepo.getInstance();