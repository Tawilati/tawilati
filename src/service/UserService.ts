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
import { AuthenticationException } from "@/utils/exceptions/http/AuthenticationException";
import { User } from "@/app/generated/prisma/client";

// Compared against when the email is unknown, so a login takes the same time
// whether or not the account exists.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("tawilati-no-such-user", 10);

export class UserService {
  private static instance: UserService;

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }
  // Unknown email, wrong password and deactivated account all get the same 401
  // invalid_credentials, so the answer never tells which emails have an account.
  async validateUser(email: string, pass: string): Promise<User> {
    let targetUser: User | null = null;
    try {
      targetUser = await userRepo.getByEmail(email.trim().toLowerCase());
    } catch (err) {
      if (!(err instanceof ItemNotFoundException)) throw err;
    }

    // Always run bcrypt, even with no user (see DUMMY_PASSWORD_HASH).
    const passwordMatches = await bcrypt.compare(pass, targetUser?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!targetUser || !passwordMatches || !targetUser.isActive) {
      logger.warn("Login attempt failed: invalid credentials");
      throw new AuthenticationException("invalid_credentials");
    }
    return targetUser;
  }
  // For the sign-up form, before it is sent. Business names are public (guests see them on the
  // menu), so saying a name is taken reveals nothing private. Register still checks again.
  async isBusinessNameAvailable(name: string): Promise<boolean> {
    return !(await businessRepo.existsByName(name));
  }

  async registerUser(data:{businessName:string,ownerName:string,email:string,password:string}): Promise<RegisterResponse> {
    // 1. Normalize email ONCE — used for both the check and the insert
    const email = data.email.trim().toLowerCase();

    // 2. Pre-check — friendly 409 for the common case
    if (await userRepo.existsByEmail(email)) {
      logger.info('email taken')
      throw new ConflictException("email_already_in_use");
    }

    // Business names are unique (one name = one café). A race past this check
    // hits Business_name_key and handleRouteError answers the same code.
    if (await businessRepo.existsByName(data.businessName)) {
      logger.info('business name taken')
      throw new ConflictException("business_name_taken");
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