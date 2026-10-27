// src/service/UserService.ts
import { userRepo } from "@/repository/UserRepo";
import {
  mapToRegisterResponse,
  type RegisterRequest,
  type RegisterResponse,
} from "@/types/User";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { slugService } from "./SlugService";
import bcrypt from "bcryptjs";
import { businessRepo } from "@/repository/BusinessRepo";
import prisma from "@/lib/db";
import { UserRole } from "@/app/generated/prisma/enums";
import { makeSlug } from "@/utils/slug";

export class UserService {
  private static instance: UserService;

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  async registerUser(data: RegisterRequest): Promise<RegisterResponse> {
    // 1. Normalize email ONCE — used for both the check and the insert
    const email = data.email.trim().toLowerCase();

    // 2. Pre-check — friendly 409 for the common case
    if (await userRepo.existsByEmail(email)) {
      throw new ConflictException("email already in use");
    }

    // 3. Derive unique slug
    const slug = await slugService.uniqueBusinessSlug(makeSlug(data.businessName,"business"));

    // 4. Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // 5. Atomic insert (Business + Owner)
    return prisma.$transaction(async (tx) => {
      const business = await businessRepo.create(tx, data.businessName, slug);

      const owner = await userRepo.create(
        {
          businessId: business.id,
          name: data.ownerName,
          email,                    // ← normalized
          passwordHash,
          role: UserRole.OWNER,
        },
        tx
      );

      return mapToRegisterResponse(
        business.id,
        owner.id,
        owner.role,
        business.slug
      );
    });
  }
}

export const userService = UserService.getInstance();