import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { waiterService } from "@/service/WaiterService";
import { PERMISSION } from "@/types/Roles";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.WAITER_TABLES_READ });
    if (denied) return denied;

    const { id } = await params;
    const businessId = getBusinessIdFromRequest(request)!;
    const result = await waiterService.confirmGuest(id, businessId);

    return NextResponse.json({
      success: true,
      message: "guest confirmed",
      data: { guestSessionId: result.id, status: result.status },
    });
  });
}