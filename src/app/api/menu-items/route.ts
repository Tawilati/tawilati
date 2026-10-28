
import type { NextRequest } from "next/server";

import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { menuItemService } from "@/service/MenuItemsService";
import { PERMISSION } from "@/types/Roles";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { handleRouteError } from "@/utils/handleRouteError";
import { createMenuItemSchema } from "@/validation/menuItemsSchemas";

// Ensures the request contains a business context.
function requireBusinessId(request: NextRequest): string {
  const businessId = getBusinessIdFromRequest(request);

  if (!businessId) {
    throw new BadRequestException("missing_business_context");
  }

  return businessId;
}

// GET /api/menu-items
// Retrieves all menu items belonging to the authenticated business.
export async function GET(request: NextRequest) {
  try {
    return await handle(async () => {
      // Check permission to read menu items.
      const authResponse = authGuard(request, {
        requirePermission: PERMISSION.MENU_ITEM_READ,
      });

      if (authResponse) return authResponse;

      // Get the business context for tenant isolation.
      const businessId = requireBusinessId(request);

      // Fetch menu items through the service layer.
      const menuItems = await menuItemService.getAll(businessId);

      return Response.json({ menuItems });
    });
  } catch (error) {
    // Convert propagated errors into HTTP responses using the project's shared error handler.
    return handleRouteError(error);
  }
}

// POST /api/menu-items
// Creates a menu item for the authenticated business.
export async function POST(request: NextRequest) {
  try {
    return await handle(async () => {
      // Check permission to create menu items.
      const authResponse = authGuard(request, {
        requirePermission: PERMISSION.MENU_ITEM_WRITE,
      });

      if (authResponse) return authResponse;

      // Get the business context for tenant isolation.
      const businessId = requireBusinessId(request);

      let body: unknown;

      try {
        // Parse the incoming JSON body.
        body = await request.json();
      } catch {
        // Invalid JSON is treated as a client validation error.
        throw new BadRequestException("validation_error");
      }

      // Validate the request body against the creation schema.
      const result = createMenuItemSchema.safeParse(body);

      if (!result.success) {
        // handleRouteError maps ZodError to HTTP 400.
        throw result.error;
      }

      // Create the menu item through the service layer.
      const menuItem = await menuItemService.create(
        businessId,
        result.data,
      );

      // Return HTTP 201 when creation succeeds.
      return Response.json({ menuItem }, { status: 201 });
    });
  } catch (error) {
    //Use the same shared error handler as GET.
    return handleRouteError(error);
  }
}
