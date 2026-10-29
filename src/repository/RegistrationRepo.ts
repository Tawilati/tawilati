import { Prisma } from "@/app/generated/prisma/client";
import { UserRole as UserRoleEnum } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { businessRepo } from "@/repository/BusinessRepo";
import { userRepo } from "@/repository/UserRepo";
import type { RegisterOwnerData, RegistrationRecord } from "@/types/User";
import { DBException } from "@/utils/exceptions/RepoException";

export class RegistrationRepo {
  private static instance: RegistrationRepo;

  //Prevents other files from creating instances with `new`.
  private constructor() {}

  static getInstance(): RegistrationRepo {
    if (!RegistrationRepo.instance) {
      RegistrationRepo.instance = new RegistrationRepo();
    }
    return RegistrationRepo.instance;
  }

  async registerOwner(data: RegisterOwnerData): Promise<RegistrationRecord> {
    try {
      return await prisma.$transaction(async (tx) => {
        const business = await businessRepo.create(tx, data.businessName, data.slug);
        const owner = await userRepo.create(
          {
            businessId: business.id,
            name: data.ownerName,
            email: data.email,
            passwordHash: data.passwordHash,
            role: UserRoleEnum.OWNER,
          },
          tx,
        );

        return {
          businessId: business.id,
          userId: owner.id,
          role: owner.role,
          slug: business.slug,
        };
      });
    } catch (err) {
      // Already shaped by businessRepo / userRepo: a DBException, or P2002 for a taken name or email (409).
      if (err instanceof DBException) throw err;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw err;
      throw new DBException("Error registering owner", err as Error);
    }
  }
}

export const registrationRepo = RegistrationRepo.getInstance();
