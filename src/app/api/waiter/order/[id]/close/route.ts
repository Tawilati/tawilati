import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest, getUserIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody, parseParams } from "@/lib/http";
import { waiterService } from "@/service/WaiterService";
import { PERMISSION } from "@/types/Roles";
import { tabIdSchema } from "@/validation/orderSchemas";

const schema = z.object({
  amountReceivedUSD: z.number().min(0),
  amountReceivedLBP: z.number().min(0),
  method: z.enum(["CASH", "EXTERNAL_CARD"]),
});

// POST /api/waiter/order/:id/close (:id is a tab, TableSession, not a round)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const denied = authGuard(request, {
      requirePermission: PERMISSION.TAB_CLOSE,
    });
    if (denied) return denied;

    const { id } = await parseParams(params, tabIdSchema);
    const businessId = getBusinessIdFromRequest(request)!;
    const waiterId = getUserIdFromRequest(request)!;
    const body = await parseBody(request, schema);

    const result = await waiterService.closeTab(id, businessId, waiterId, body);

    return NextResponse.json({
      success: true,
      message: "tab closed",
      data: result,
    });
  });
}