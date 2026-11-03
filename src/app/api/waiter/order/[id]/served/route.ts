import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseParams } from "@/lib/http";
import { waiterService } from "@/service/WaiterService";
import { PERMISSION } from "@/types/Roles";
import { orderIdSchema } from "@/validation/orderSchemas";

// PATCH /api/waiter/order/:id/served (:id is a round, DiningOrder)
// Marks a READY order as SERVED (delivered to the table).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.ORDER_STATUS_SERVED });
    if (denied) return denied;

    const { id } = await parseParams(params, orderIdSchema);
    const businessId = getBusinessIdFromRequest(request)!;

    const result = await waiterService.markOrderServed(id, businessId);

    return NextResponse.json({
      success: true,
      message: "order marked as served",
      data: result,
    });
  });
}