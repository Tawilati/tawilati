import { Prisma, type User } from "@/app/generated/prisma/client";
import { UserRole } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type { CreateStaffData } from "@/types/Staff";
import type { UpdateStaffInput } from "@/validation/staff";
import { DBException } from "@/utils/exceptions/RepoException";

// Owners are not staff: they are never listed or edited through /api/staff.
const STAFF_ROLES: UserRole[] = [UserRole.WAITER, UserRole.KITCHEN];

export class StaffRepo {
  private static instance: StaffRepo;

  //Prevents other files from creating instances with `new`.
  private constructor() {}

  static getInstance(): StaffRepo {
    if (!StaffRepo.instance) {
      StaffRepo.instance = new StaffRepo();
    }
    return StaffRepo.instance;
  }

  async emailExists(email: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      return user !== null;
    } catch (err) {
      throw new DBException("Error checking staff email", err as Error);
    }
  }

  async create(data: CreateStaffData): Promise<User> {
    try {
      return await prisma.user.create({ data });
    } catch (err) {
      // Unique violation (email taken in a race): handleRouteError answers 409 email_already_in_use.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw err;
      throw new DBException("Error creating staff", err as Error);
    }
  }

  async listByBusiness(businessId: string): Promise<User[]> {
    try {
      return await prisma.user.findMany({
        where: { businessId, role: { in: STAFF_ROLES } },
        orderBy: { createdAt: "asc" },
      });
    } catch (err) {
      throw new DBException("Error listing staff", err as Error);
    }
  }

  async findInBusiness(id: string, businessId: string): Promise<User | null> {
    try {
      return await prisma.user.findFirst({ where: { id, businessId, role: { in: STAFF_ROLES } } });
    } catch (err) {
      throw new DBException("Error loading staff", err as Error);
    }
  }

 async update(
  id: string,
  businessId: string,
  data: UpdateStaffInput
): Promise<User> {
  // Build the update payload explicitly
  const updateData: Prisma.UserUpdateInput = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.role !== undefined && { role: data.role }),
    ...(data.isActive !== undefined && { isActive: data.isActive }),
  };

  // If deactivating, clear the refresh tokens
  if (data.isActive === false) {
    updateData.refreshToken = null;
    updateData.refreshTokenExpiresAt = null;
  }

  try {
    return await prisma.user.update({
      where: { id, businessId },
      data: updateData,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") throw err;
    throw new DBException("Error updating staff", err as Error);
  }
}
}

export const staffRepo = StaffRepo.getInstance();
