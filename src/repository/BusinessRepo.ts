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
import { menuItemRepo } from "@/repository/MenuItemsRepo";
import type { UpdateBusinessData } from "@/types/Business";
import type { DbClient } from "@/types/Db";
import { DBException, ItemNotFoundException } from "@/utils/exceptions/RepoException";
import logger from "@/utils/logger";

export class BusinessRepo {
  private static instance: BusinessRepo;

  //Prevents other files from creating instances with `new`.
  private constructor() {}

  static getInstance(): BusinessRepo {
    if (!BusinessRepo.instance) {
      BusinessRepo.instance = new BusinessRepo();
    }
    return BusinessRepo.instance;
  }

  async existsByName(name: string): Promise<boolean> {
    try {
      const business = await prisma.business.findUnique({
        where: { name },
        select: { id: true },
      });
      return business !== null;
    } catch (err) {
      throw new DBException("Error checking business name", err as Error);
    }
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
          exchangeRate: new Prisma.Decimal("890000"),
          timezone: "Asia/Beirut",
        },
      });
    } catch (err) {
         // Let P2002 bubble up unwrapped so handleRouteError can map it
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw err;
    }
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DBException("Error creating business", error);
    }
  }
  async getById(id:string):Promise<Business>{
    try{
      const targetBusiness=await prisma.business.findUnique({
        where:{id:id}
      })
      if(targetBusiness==null){
        logger.error('business doesnot exist');
        throw new ItemNotFoundException('business not found')
      }
      return targetBusiness;
    }
    catch(error){
      // The not-found thrown above must stay a 404, not become a 500.
      if (error instanceof ItemNotFoundException) {
        throw error;
      }
      logger.error('error when retrieving');
      throw new DBException('error whil getting the business',error as Error);
    }
  }

  // Saves the new settings; a new exchange rate also reprices every menu item, in the same transaction.
  async updateSettings(businessId: string, data: UpdateBusinessData): Promise<Business> {
    try {
      return await prisma.$transaction(async (tx) => {
        const business = await tx.business.update({
          where: { id: businessId },
          data,
        });

        if (data.exchangeRate !== undefined) {
          await menuItemRepo.repriceLBP(tx, businessId, data.exchangeRate);
        }

        return business;
      });
    } catch (err) {
      // P2025: the business row is gone.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new ItemNotFoundException("business not found");
      }
      // Already wrapped by menuItemRepo.repriceLBP.
      if (err instanceof DBException) throw err;
      throw new DBException("Error updating business settings", err as Error);
    }
  }
}

export const businessRepo = BusinessRepo.getInstance();