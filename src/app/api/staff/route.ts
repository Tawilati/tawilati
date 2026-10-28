import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody } from "@/lib/http";
import { staffService } from "@/service/StaffService";
import { PERMISSION } from "@/types/Roles";
import { createStaffSchema } from "@/validation/staff";

// POST /api/staff (OWNER): create a waiter or kitchen account in the owner's business.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.STAFF_CREATE });
    if (denied) return denied;

    const input = await parseBody(request, createStaffSchema);
    // The guard has checked the identity headers, so the business id is there.
    const staff = await staffService.createStaff(getBusinessIdFromRequest(request)!, input);
    return NextResponse.json({ success: true, message: "staff created", data: staff }, { status: 201 });
  });
}

// GET /api/staff (OWNER): every waiter and kitchen account in the owner's business.
export async function GET(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.STAFF_LIST });
    if (denied) return denied;

    const staff = await staffService.listStaff(getBusinessIdFromRequest(request)!);
    return NextResponse.json({ success: true, message: "staff list", data: staff });
  });
}
