import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody, parseParams } from "@/lib/http";
import { menuItemService } from "@/service/MenuItemsService";
import { PERMISSION } from "@/types/Roles";
import { menuItemIdSchema } from "@/validation/menuItemsSchemas";

const bodySchema = z.object({
  soldOut: z.boolean(),
});

// PATCH /api/menu-items/:id/sold-out
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const denied = authGuard(request, {
      requirePermission: PERMISSION.SOLD_OUT_TOGGLE,
    });
    if (denied) return denied;

    const { id } = await parseParams(params, menuItemIdSchema);
    const { soldOut } = await parseBody(request, bodySchema);
    const businessId = getBusinessIdFromRequest(request)!;

    const item = await menuItemService.setSoldOut(id, businessId, soldOut);

    // Invalidate the cached menu so the guest sees the change
    revalidatePath("/menu/[business]/[table]", "page");

    return NextResponse.json({
      success: true,
      message: `item marked as ${soldOut ? "sold out" : "available"}`,
      data: { id: item.id, soldOut: item.soldOut },
    });
  });
}