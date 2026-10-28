import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody } from "@/lib/http";
import { menuItemService } from "@/service/MenuItemsService";
import { PERMISSION } from "@/types/Roles";
import { createMenuItemSchema } from "@/validation/menuItemsSchemas";

// GET /api/menu-items (staff): every item in the business, archived ones included.
export async function GET(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.MENU_ITEM_READ });
    if (denied) return denied;

    // The guard has checked the identity headers, so the business id is there.
    const menuItems = await menuItemService.getAll(getBusinessIdFromRequest(request)!);
    return NextResponse.json({ success: true, message: "menu items list", data: menuItems });
  });
}

// POST /api/menu-items (OWNER): priceLBP is worked out from priceUSD and the business's rate.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.MENU_ITEM_WRITE });
    if (denied) return denied;

    const input = await parseBody(request, createMenuItemSchema);
    const menuItem = await menuItemService.create(getBusinessIdFromRequest(request)!, input);
    return NextResponse.json({ success: true, message: "menu item created", data: menuItem }, { status: 201 });
  });
}
