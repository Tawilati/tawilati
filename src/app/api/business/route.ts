import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody } from "@/lib/http";
import { businessService } from "@/service/BusinessService";
import { PERMISSION } from "@/types/Roles";
import { updateBusinessSchema } from "@/validation/businessSchemas";

// GET /api/business (staff): the signed-in user's business settings (name, exchange rate, timezone).
export async function GET(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.BUSINESS_READ });
    if (denied) return denied;

    // The guard has checked the identity headers, so the business id is there.
    const business = await businessService.getById(getBusinessIdFromRequest(request)!);
    return NextResponse.json({ success: true, message: "business settings", data: business });
  });
}

// PATCH /api/business (OWNER): exchange rate and/or timezone; a new rate reprices every menu item in LBP.
export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.BUSINESS_UPDATE });
    if (denied) return denied;

    const patch = await parseBody(request, updateBusinessSchema);
    const business = await businessService.updateSettings(getBusinessIdFromRequest(request)!, patch);
    return NextResponse.json({ success: true, message: "business updated", data: business });
  });
}
