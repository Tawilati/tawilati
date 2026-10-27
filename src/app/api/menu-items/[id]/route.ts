
import type { NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { menuItemService } from "@/service/MenuItemsService";
import { PERMISSION } from "@/types/Roles";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { updateMenuItemSchema } from "@/validation/menuItemsSchemas";

function requireBusinessId(request: NextRequest): string {
  const businessId = getBusinessIdFromRequest(request);

  if (!businessId) {
    throw new BadRequestException("missing_business_context");
  }

  return businessId;
}

// PATCH /api/menu-items/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const authResponse = authGuard(request, {
      requirePermission: PERMISSION.MENU_ITEM_WRITE,
    });

    if (authResponse) return authResponse;

    const businessId = requireBusinessId(request);
    const { id } = await params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new BadRequestException("validation_error");
    }

    const result = updateMenuItemSchema.safeParse(body);

    if (!result.success) throw result.error;

    const menuItem = await menuItemService.update(
      businessId,
      id,
      result.data,
    );

    return Response.json({ menuItem });
  });
}
