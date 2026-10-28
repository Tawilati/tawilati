import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseParams } from "@/lib/http";
import { menuItemService } from "@/service/MenuItemsService";
import { PERMISSION } from "@/types/Roles";
import { menuItemIdSchema } from "@/validation/menuItemsSchemas";

// POST /api/menu-items/:id/unarchive (OWNER): back on the menu; 409 menu_item_not_archived if it wasn't archived.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.MENU_ITEM_ARCHIVE });
    if (denied) return denied;

    const { id } = await parseParams(params, menuItemIdSchema);
    const menuItem = await menuItemService.unarchive(getBusinessIdFromRequest(request)!, id);
    return NextResponse.json({ success: true, message: "menu item restored", data: menuItem });
  });
}
