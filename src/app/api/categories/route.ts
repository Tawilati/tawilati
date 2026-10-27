
import type { NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { categoryRepo } from "@/repository/CategoryRepo";
import { CategoryService } from "@/service/CategoryService";
import { PERMISSION } from "@/types/Roles";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { createCategorySchema } from "@/validation/categorySchemas";

const categoryService = new CategoryService(categoryRepo);

function requireBusinessId(request: NextRequest): string {
  const businessId = getBusinessIdFromRequest(request);
  if (!businessId) throw new BadRequestException("missing_business_context");
  return businessId;
}

// GET /api/categories
export async function GET(request: NextRequest) {
  return handle(async () => {
    const authResponse = authGuard(request, {
      requirePermission: PERMISSION.CATEGORY_READ,
    });
    if (authResponse) return authResponse;

    const businessId = requireBusinessId(request);
    const categories = await categoryService.listCategories(businessId);

    return Response.json({ categories });
  });
}

// POST /api/categories
export async function POST(request: NextRequest) {
  return handle(async () => {
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
    if (!result.success) throw result.error;

    const category = await categoryService.createCategory(
      businessId,
      result.data.name,
    );

    return Response.json({ category }, { status: 201 });
  });
}
