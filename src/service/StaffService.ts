import bcrypt from "bcryptjs";
import { staffRepo } from "@/repository/StaffRepo";
import {  mapToStaffResponse, mapToStaffResponseList,  type StaffResponse } from "@/types/Staff";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import logger from "@/utils/logger";
import { CreateStaffInput, UpdateStaffInput } from "@/validation/staff";


// businessId always comes from the signed-in owner's session, never from the request body.
export class StaffService {
  private static instance: StaffService;

  //Prevents other files from creating instances with `new`.
  private constructor() {}

  static getInstance(): StaffService {
    if (!StaffService.instance) {
      StaffService.instance = new StaffService();
    }
    return StaffService.instance;
  }

  async createStaff(businessId: string, input: CreateStaffInput): Promise<StaffResponse> {
    // One email = one account, across all businesses. A race past this check hits
    // User_email_key and handleRouteError answers the same 409.
    if (await staffRepo.emailExists(input.email)) {
      logger.info("staff email taken");
      throw new ConflictException("email_already_in_use");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const staff = await staffRepo.create({
      businessId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });
    return mapToStaffResponse(staff);
  }

  async listStaff(businessId: string): Promise<StaffResponse[]> {
    const staff = await staffRepo.listByBusiness(businessId);
    return mapToStaffResponseList(staff);
  }

  // Another business's staff, an unknown id and an owner account all get the same 404.
  async updateStaff(businessId: string, id: string, patch: UpdateStaffInput): Promise<StaffResponse> {
    const staff = await staffRepo.findInBusiness(id, businessId);
    if (!staff) throw new NotFoundException("not_found");

    const updated = await staffRepo.update(id, businessId, {
      ...patch,
      // Deactivating also drops the stored refresh token, so the session can't be renewed;
      // login already refuses inactive accounts.
     
    });
    return mapToStaffResponse(updated);
  }
}

export const staffService = StaffService.getInstance();
