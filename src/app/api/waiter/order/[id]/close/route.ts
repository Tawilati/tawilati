import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest, getUserIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody } from "@/lib/http";
import { waiterService } from "@/service/WaiterService";
import { PERMISSION } from "@/types/Roles";

const schema = z.object({
  amountReceivedUSD: z.number().min(0),
  amountReceivedLBP: z.number().min(0),
  method: z.enum(["CASH", "EXTERNAL_CARD"]),
});

// POST /api/waiter/tables/:id/close
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const denied = authGuard(request, {
      requirePermission: PERMISSION.TAB_CLOSE,
    });
    if (denied) return denied;

    const { id } = await params;
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