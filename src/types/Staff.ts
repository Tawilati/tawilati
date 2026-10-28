// src/types/Staff.ts
import type { User, UserRole } from "@/app/generated/prisma/client";

// Owners create these two roles only.
export type StaffRole = "WAITER" | "KITCHEN";

// What /api/staff sends back: never the password hash or the tokens.
export interface StaffResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}






export function mapToStaffResponse(user: User): StaffResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export function mapToStaffResponseList(users: User[]): StaffResponse[] {
  return users.map(mapToStaffResponse);
}
