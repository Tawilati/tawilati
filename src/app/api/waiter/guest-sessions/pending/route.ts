import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { waiterService } from "@/service/WaiterService";
import { PERMISSION } from "@/types/Roles";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.WAITER_TABLES_READ });
    if (denied) return denied;

    const businessId = getBusinessIdFromRequest(request)!;
    const guests = await waiterService.getPendingGuests(businessId);

    return NextResponse.json({
      success: true,
      message: "pending guests",
      data: guests,
    });
  });
}