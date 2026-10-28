import type { UserRole } from "@/app/generated/prisma/client";
import { UserRole as UserRoleEnum } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { businessRepo } from "@/repository/BusinessRepo";
import { userRepo } from "@/repository/UserRepo";

export type RegisterOwnerData = {
  businessName: string;
  ownerName: string;
  email: string;
  passwordHash: string;
  slug: string;
};

export type RegistrationRecord = {
  businessId: string;
  userId: string;
  role: UserRole;
  slug: string;
};

export class RegistrationRepo {
  private static instance: RegistrationRepo;

  static getInstance(): RegistrationRepo {
    if (!RegistrationRepo.instance) {
      RegistrationRepo.instance = new RegistrationRepo();
    }
    return RegistrationRepo.instance;
  }

  async registerOwner(data: RegisterOwnerData): Promise<RegistrationRecord> {
    return prisma.$transaction(async (tx) => {
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
  }
}

export const registrationRepo = RegistrationRepo.getInstance();
