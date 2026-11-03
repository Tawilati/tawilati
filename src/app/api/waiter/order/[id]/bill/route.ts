import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseParams } from "@/lib/http";
import { waiterService } from "@/service/WaiterService";
import { PERMISSION } from "@/types/Roles";
import { tabIdSchema } from "@/validation/orderSchemas";

// GET /api/waiter/order/:id/bill (:id is a tab, TableSession, not a round)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.BILL_READ });
    if (denied) return denied;

    const { id } = await parseParams(params, tabIdSchema);
    const businessId = getBusinessIdFromRequest(request)!;
    const bill = await waiterService.getBill(id, businessId);

    return NextResponse.json({
      success: true,
      message: "table bill",
      data: bill,
    });
  });
}