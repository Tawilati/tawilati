// src/repository/BusinessRepo.ts
/**I used tx meaning transaction since we are treating the creation of business and user when register as one rollback when one of them have an error also we are gonna use tx in following

#	Operation	Tables	Why tx
1	Register	Business + User	Two inserts, atomic (A-01)
2	Issue guest session	TableSession + GuestSession	Find-or-create session + insert credential
3	Submit order	Submission + OrderLine + DiningOrder	Three tables, atomic (E-03, E-05)
4	Record payment	Payment + TableSession	Insert payment + increment amountPaid
5	Close tab	TableSession + GuestSession	Update status + revoke all credentials (G-05)
6	Any future multi-table write	—	Same rule


**/





import { Prisma, type Business } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DBException } from "@/utils/exceptions/RepoException";

type DbClient = Prisma.TransactionClient | typeof prisma;

export class BusinessRepo {
  private static instance: BusinessRepo;

  static getInstance(): BusinessRepo {
    if (!BusinessRepo.instance) {
      BusinessRepo.instance = new BusinessRepo();
    }
    return BusinessRepo.instance;
  }

  async create(
    tx: DbClient,          
    name: string,
    slug: string
  ): Promise<Business> {
    try {
      return await tx.business.create({   // ← use tx, not prisma
        data: {
          name,
          slug,
          exchangeRate: new Prisma.Decimal("89500"),
          timezone: "Asia/Beirut",
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DBException("Error creating business", error);
    }
  }
}

export const businessRepo = BusinessRepo.getInstance();