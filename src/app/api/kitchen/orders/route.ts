import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { kitchenService } from "@/service/KitchenService";
import { PERMISSION } from "@/types/Roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, {
      requirePermission: PERMISSION.KITCHEN_QUEUE_READ,
    });
    if (denied) return denied;

    const orders = await kitchenService.getKitchenOrders(
      getBusinessIdFromRequest(request)!,
    );

    return NextResponse.json({
      success: true,
      message: "kitchen orders",
      data: orders,
    });
  });
}
