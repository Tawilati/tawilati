import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody, parseParams } from "@/lib/http";

import { PERMISSION } from "@/types/Roles";
import { kitchenService } from "@/service/KitchenService";
import { orderIdSchema } from "@/validation/orderSchemas";

// PATCH /api/kitchen/:id (:id is a round, DiningOrder): NEW → PREPARING → READY.

const statusSchema = z.object({
  status: z.enum(["PREPARING", "READY"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.KITCHEN_WRITE });
    if (denied) return denied;

    const { id } = await parseParams(params, orderIdSchema);
    const { status } = await parseBody(request, statusSchema);
    const businessId = getBusinessIdFromRequest(request)!;

    const result = await kitchenService.updateKitchenOrderStatus(id, businessId, status);

    return NextResponse.json({
      success: true,
      message: `order marked as ${status.toLowerCase()}`,
      data: result,
    });
  });
}