import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody, parseParams } from "@/lib/http";
import { menuItemService } from "@/service/MenuItemsService";
import { PERMISSION } from "@/types/Roles";
import { menuItemIdSchema, updateMenuItemSchema } from "@/validation/menuItemsSchemas";

// PATCH /api/menu-items/:id (OWNER): any of name, categoryId, priceUSD, soldOut; a new priceUSD recomputes priceLBP.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.MENU_ITEM_WRITE });
    if (denied) return denied;

    const { id } = await parseParams(params, menuItemIdSchema);
    const patch = await parseBody(request, updateMenuItemSchema);
    const menuItem = await menuItemService.update(getBusinessIdFromRequest(request)!, id, patch);
    return NextResponse.json({ success: true, message: "menu item updated", data: menuItem });
  });
}
