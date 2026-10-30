import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { DbClient } from "@/types/Db";
import { DBException } from "@/utils/exceptions/RepoException";

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
  ) {
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
}

export const guestSessionRepo = GuestSessionRepo.getInstance();