import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody, parseParams } from "@/lib/http";
import { staffService } from "@/service/StaffService";
import { PERMISSION } from "@/types/Roles";
import { staffIdSchema, updateStaffSchema } from "@/validation/staff";

// PATCH /api/staff/:id (OWNER): rename, change role, deactivate (isActive: false) or reactivate.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.STAFF_UPDATE });
    if (denied) return denied;

    const { id } = await parseParams(params, staffIdSchema);
    const patch = await parseBody(request, updateStaffSchema);

    const staff = await staffService.updateStaff(getBusinessIdFromRequest(request)!, id, patch);
    return NextResponse.json({ success: true, message: "staff updated", data: staff });
  });
}
