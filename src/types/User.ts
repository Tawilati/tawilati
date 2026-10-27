// src/types/auth.ts
import type { UserRole } from "@/app/generated/prisma/client";

export interface RegisterRequest {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  success: true;
  message: string;
  businessId: string;
  userId: string;
  role: UserRole;
  slug: string;
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