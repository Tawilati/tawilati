// src/types/auth.ts
import type { UserRole } from "@/app/generated/prisma/client";
import type { RegisterUserRequest } from "@/validation/User";

export type RegisterRequest = RegisterUserRequest;

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
