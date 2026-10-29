// src/service/UserService.ts
import { userRepo } from "@/repository/UserRepo";
import {
  mapToRegisterResponse,
  mapToStaffProfile,
  type AuthenticatedUser,
  type RegisterRequest,
  type RegisterResponse,
  type StaffProfile,
} from "@/types/User";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { slugService } from "./SlugService";
import bcrypt from "bcryptjs";
import { businessRepo } from "@/repository/BusinessRepo";
import { registrationRepo } from "@/repository/RegistrationRepo";
import { makeSlug } from "@/utils/slug";
import logger from "@/utils/logger";
import { ItemNotFoundException } from "@/utils/exceptions/RepoException";
import { AuthenticationException } from "@/utils/exceptions/http/AuthenticationException";
import { ForbiddenException } from "@/utils/exceptions/http/ForbiddenException";

// Compared against when the email is unknown, so a login takes the same time
// whether or not the account exists.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("tawilati-no-such-user", 10);

export class UserService {
  private static instance: UserService;

  //Prevents other files from creating instances with `new`.
  private constructor() {}

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }
  // Unknown email and wrong password get the same 401 invalid_credentials, so the answer never tells
  // which emails have an account. A deactivated account gets 403 account_deactivated, but only once
  // the password has matched: only someone who already knows it learns the account is turned off.
  async validateUser(email: string, pass: string): Promise<AuthenticatedUser> {
    let targetUser: AuthenticatedUser | null = null;
    try {
      targetUser = await userRepo.getByEmail(email.trim().toLowerCase());
    } catch (err) {
      if (!(err instanceof ItemNotFoundException)) throw err;
    }

    // Always run bcrypt, even with no user (see DUMMY_PASSWORD_HASH).
    const passwordMatches = await bcrypt.compare(pass, targetUser?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!targetUser || !passwordMatches ) {
      logger.warn("Login attempt failed: invalid credentials");
      throw new AuthenticationException("invalid_credentials");
    }
    if(!targetUser.isActive){
      logger.warn("Login attempt failed: account deactivated");
      throw new ForbiddenException("account_deactivated");
    }
    return targetUser;
  }
  // Re-read on every staff screen, so deactivating someone or changing their role takes effect at once.
  // null when the user is gone, deactivated, or not in the business their token names.
  async getStaffProfile(userId: string, businessId: string): Promise<StaffProfile | null> {
    const user = await userRepo.findStaffProfile(userId);
    if (!user || !user.isActive || user.businessId !== businessId) return null;
    return mapToStaffProfile(user);
  }

  // For the sign-up form, before it is sent. Business names are public (guests see them on the
  // menu), so saying a name is taken reveals nothing private. Register still checks again.
  async isBusinessNameAvailable(name: string): Promise<boolean> {
    return !(await businessRepo.existsByName(name));
  }

  async registerUser(data: RegisterRequest): Promise<RegisterResponse> {
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

    // The repository keeps business and owner creation in one transaction.
    const registration = await registrationRepo.registerOwner({
      businessName: data.businessName,
      ownerName: data.ownerName,
      email,
      passwordHash,
      slug,
    });

    return mapToRegisterResponse(
      registration.businessId,
      registration.userId,
      registration.role,
      registration.slug,
    );
  }
}

export const userService = UserService.getInstance();