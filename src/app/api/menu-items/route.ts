
import type { NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { menuItemService } from "@/service/MenuItemsService";
import { PERMISSION } from "@/types/Roles";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { createMenuItemSchema } from "@/validation/menuItemsSchemas";

function requireBusinessId(request: NextRequest): string {
  const businessId = getBusinessIdFromRequest(request);

  if (!businessId) {
    throw new BadRequestException("missing_business_context");
  }

  return businessId;
}

// GET /api/menu-items
export async function GET(request: NextRequest) {
  return handle(async () => {
    const authResponse = authGuard(request, {
      requirePermission: PERMISSION.MENU_ITEM_READ,
    });

    if (authResponse) return authResponse;

    const businessId = requireBusinessId(request);
    const menuItems = await menuItemService.getAll(businessId);

    return Response.json({ menuItems });
  });
}

// POST /api/menu-items
export async function POST(request: NextRequest) {
  return handle(async () => {
    const authResponse = authGuard(request, {
      requirePermission: PERMISSION.MENU_ITEM_WRITE,
    });

    if (authResponse) return authResponse;

    const businessId = requireBusinessId(request);

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new BadRequestException("validation_error");
    }

    const result = createMenuItemSchema.safeParse(body);

    if (!result.success) throw result.error;

    const menuItem = await menuItemService.create(
      businessId,
      result.data,
    );

    return Response.json({ menuItem }, { status: 201 });
  });
}
