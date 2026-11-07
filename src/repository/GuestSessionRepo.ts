import { GuestSession, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { DbClient } from "@/types/Db";
import { GuestBillRecord } from "@/types/Order";
import { DBException } from "@/utils/exceptions/RepoException";
import logger from "@/utils/logger";
export type GuestSessionWithTable = Prisma.GuestSessionGetPayload<{
  include: {
    session: {
      include: {
        table: true;
      };
    };
  };
}>;

export class GuestSessionRepo {
  private static instance: GuestSessionRepo;

  private constructor() {}

  static getInstance(): GuestSessionRepo {
    if (!GuestSessionRepo.instance) {
      GuestSessionRepo.instance = new GuestSessionRepo();
    }

    return GuestSessionRepo.instance;
  }
  async create(
    data: {
      sessionId: string;
      token: string;
      expiresAt: Date;
    },
    tx: DbClient = prisma,
  ):Promise<GuestSession> {
    try {
      return await tx.guestSession.create({
        data,
       
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw error;
      }

      throw new DBException(
        "Error creating guest session",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
  async FindByToken(token:string):Promise<GuestSessionWithTable | null>{
    try{
        return await prisma.guestSession.findUnique({
            where:{token},
            include:{
                session:{
                    include:{
                        table:true
                    }
                }
            }
        })
    }
    catch(err){
        logger.error('canot find guest session');
        throw new DBException('canot find guest session',err  as Error);
    }

  }
   async extend(
    guestSessionId: string,
    newExpiresAt: Date,
    tx: DbClient = prisma,
  ): Promise<Prisma.GuestSessionGetPayload<{}>> {
    try {
      return await tx.guestSession.update({
        where: { id: guestSessionId },
        data: { expiresAt: newExpiresAt },
      });
    } catch (error) {
      throw new DBException(
        "Error extending guest session",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
  async getGuestBill(guestSessionId: string): Promise<GuestBillRecord | null> {
  return await prisma.guestSession.findUnique({
    where: { id: guestSessionId },
    include: {
      session: {
        include: {
          table: { select: { label: true } },
        },
      },
      orders: {
        include: {
          orderLines: {
            include: { menuItem: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
async findById(guestSessionId: string) {
  try {
    return await prisma.guestSession.findUnique({
      where: { id: guestSessionId },
      include: {
        session: {
          include: { table: { select: { label: true } } },
        },
      },
    });
  } catch (error) {
    throw new DBException("Error finding guest session", error as Error);
  }
}

async findPendingByBusiness(businessId: string) {
  try {
    return await prisma.guestSession.findMany({
      where: {
        status: "PENDING",
        session: { businessId, status: "OPEN" },
      },
      include: {
        session: {
          include: { table: { select: { label: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    throw new DBException("Error finding pending guests", error as Error);
  }
}

async updateStatus(
  guestSessionId: string,
  status: "ACTIVE" | "REJECTED",
  tx: DbClient = prisma,
) {
  try {
    return await tx.guestSession.update({
      where: { id: guestSessionId },
      data: {
        status,
        ...(status === "REJECTED" ? { revokedAt: new Date() } : {}),
      },
    });
  } catch (error) {
    throw new DBException("Error updating guest session status", error as Error);
  }
}
}

export const guestSessionRepo = GuestSessionRepo.getInstance();