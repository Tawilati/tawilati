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
import logger from "@/utils/logger";
import { ItemNotFoundException } from "@/utils/exceptions/RepoException";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { User } from "@/app/generated/prisma/client";

export class UserService {
  private static instance: UserService;

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }
async validateUser(email:string,pass:string ):Promise<User>{
        email.trim().toLocaleLowerCase();
       const targetUser = await userRepo.getByEmail(email);

         if (!targetUser) {
      throw new ItemNotFoundException("User not found");
    }
    //compare pass
    if (!bcrypt.compareSync(pass, targetUser.passwordHash || "")) {
      logger.warn("Login attempt failed: Invalid credentials");
      throw new BadRequestException("Bad request: invalid email or password");
    }
    if(targetUser.isActive==false){
        logger.warn("Login attempt failed: Invalid credentials");
      throw new BadRequestException("Bad request:user is in activated"); 
    }
    return targetUser;
}
  async registerUser(data:{businessName:string,ownerName:string,email:string,password:string}): Promise<RegisterResponse> {
    // 1. Normalize email ONCE — used for both the check and the insert
    const email = data.email.trim().toLowerCase();

    // 2. Pre-check — friendly 409 for the common case
    if (await userRepo.existsByEmail(email)) {
      logger.info('email taken')
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