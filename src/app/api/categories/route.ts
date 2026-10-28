
import type { NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { PERMISSION } from "@/types/Roles";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { createCategorySchema } from "@/validation/categorySchemas";
import { categoryService } from "@/service/CategoryService";

//import the shared route error handler from its actual file
import { handleRouteError } from "@/utils/handleRouteError";

function requireBusinessId(request: NextRequest): string {
  const businessId = getBusinessIdFromRequest(request);

  if (!businessId) {
    throw new BadRequestException("missing_business_context");
  }

  return businessId;
}

// GET /api/categories
export async function GET(request: NextRequest) {
  try {
    const authResponse = authGuard(request, {
      requirePermission: PERMISSION.CATEGORY_READ,
    });

    if (authResponse) return authResponse;

    const businessId = requireBusinessId(request);
    const categories = await categoryService.listCategories(businessId);

    return Response.json({ categories });
  } catch (error) {
    //convert thrown errors into the correct HTTP response
    return handleRouteError(error);
  }
}

// POST /api/categories
export async function POST(request: NextRequest) {
  try {
    const authResponse = authGuard(request, {
      requirePermission: PERMISSION.CATEGORY_WRITE,
    });

    if (authResponse) return authResponse;

    const businessId = requireBusinessId(request);

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new BadRequestException("validation_error");
    }

    const result = createCategorySchema.safeParse(body);

    if (!result.success) {
      throw result.error;
    }

    const category = await categoryService.createCategory(
      businessId,
      result.data.name,
    );

    return Response.json({ category }, { status: 201 });
  } catch (error) {
    //use the shared error handler for validation, HTTP, and database errors
    return handleRouteError(error);
  }
}
