// src/types/auth.ts
import type { UserRole } from "@/app/generated/prisma/client";
import type { RegisterUserRequest } from "@/validation/User";

export type RegisterRequest = RegisterUserRequest;

export interface AuthenticatedUser {
  id: string;
  businessId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
}

export interface RegisterResponse {
  success: true;
  message: string;
  businessId: string;
  userId: string;
  role: UserRole;
  slug: string;
}
// Who is using a staff screen, as shown in the staff frame.
export interface StaffProfile {
  userId: string;
  name: string;
  role: UserRole;
  businessId: string;
  businessName: string;
}

// What userRepo.findStaffProfile returns.
export type StaffProfileRecord = {
  id: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  businessId: string;
  business: { name: string };
};

// What userRepo.create needs: the password is already hashed.
export type CreateUserData = {
  businessId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
};

// What registrationRepo.registerOwner needs and returns.
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

export function mapToStaffProfile(user: StaffProfileRecord): StaffProfile {
  return {
    userId: user.id,
    name: user.name,
    role: user.role,
    businessId: user.businessId,
    businessName: user.business.name,
  };
}

export interface LoginResponse{
  id:string,
  name:string,
  email:string,
  role:UserRole;
}

export function mapToLoginResponse(
  id: string,
  name: string,
  email: string,
  role: UserRole
): LoginResponse {
  return {
    id,
    name,
    email,
    role,
  };
}

export function mapToRegisterResponse(
  businessId: string,
  userId: string,
  role: UserRole,
  slug: string
): RegisterResponse {
  return {
    success: true,
    message: "Registration successful",
    businessId,
    userId,
    role,
    slug,
  };
}
