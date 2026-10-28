import type { NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { menuItemService } from "@/service/MenuItemsService";
import { PERMISSION } from "@/types/Roles";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";

//Import the shared route error handler
import { handleRouteError } from "@/utils/handleRouteError";

function requireBusinessId(request: NextRequest): string {
  const businessId = getBusinessIdFromRequest(request);

  if (!businessId) {
    throw new BadRequestException("missing_business_context");
  }

  return businessId;
}

// POST /api/menu-items/:id/archive
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await handle(async () => {
      const authResponse = authGuard(request, {
        requirePermission: PERMISSION.MENU_ITEM_ARCHIVE,
      });

      if (authResponse) return authResponse;

      const businessId = requireBusinessId(request);
      const { id } = await params;

      const menuItem = await menuItemService.archive(businessId, id);

      return Response.json({ menuItem });
    });
  } catch (error) {
    //Convert thrown errors into standardized HTTP responses
    return handleRouteError(error);
  }
}