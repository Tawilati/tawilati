import prisma from "@/lib/db";
import { DBException } from "@/utils/exceptions/RepoException";

export class ReportRepo {
  private static instance: ReportRepo;

  private constructor() {}

  static getInstance(): ReportRepo {
    if (!ReportRepo.instance) {
      ReportRepo.instance = new ReportRepo();
    }
    return ReportRepo.instance;
  }

  async getBusiness(businessId: string) {
    try {
      return await prisma.business.findUnique({
        where: { id: businessId },
        select: { name: true, timezone: true },
      });
    } catch (error) {
      throw new DBException("Error fetching business", error as Error);
    }
  }

  async getDailyPayments(businessId: string, start: Date, end: Date) {
    try {
      return await prisma.payment.findMany({
        where: {
          session: { businessId },
          createdAt: { gte: start, lte: end },
        },
        include: {
          recordedBy: { select: { id: true, name: true } },
          // The bill's value: a payment only says how it was split between dollars and pounds.
          session: { select: { totalUSD: true, totalLBP: true } },
        },
      });
    } catch (error) {
      throw new DBException("Error fetching daily payments", error as Error);
    }
  }

  async getDailyOrders(businessId: string, start: Date, end: Date) {
    try {
      return await prisma.diningOrder.findMany({
        where: {
          businessId,
          createdAt: { gte: start, lte: end },
          status: { not: "CANCELLED" }, // Exclude cancelled orders
        },
        include: {
          orderLines: {
            include: {
              menuItem: { select: { name: true } },
            },
          },
        },
      });
    } catch (error) {
      throw new DBException("Error fetching daily orders", error as Error);
    }
  }
}

export const reportRepo = ReportRepo.getInstance();