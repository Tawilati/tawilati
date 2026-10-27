
import type { NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { categoryRepo } from "@/repository/CategoryRepo";
import { CategoryService } from "@/service/CategoryService";
import { PERMISSION } from "@/types/Roles";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { updateCategorySchema } from "@/validation/categorySchemas";

const categoryService = new CategoryService(categoryRepo);

type RouteContext = {
  params: Promise<{ id: string }>;
};

function requireBusinessId(request: NextRequest): string {
  const businessId = getBusinessIdFromRequest(request);
  if (!businessId) throw new BadRequestException("missing_business_context");
  return businessId;
}

// GET /api/categories/:id
export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  return handle(async () => {
    const authResponse = authGuard(request, {
      requirePermission: PERMISSION.CATEGORY_READ,
    });
    if (authResponse) return authResponse;

    const businessId = requireBusinessId(request);
    const { id } = await params;
    const category = await categoryService.getCategory(id, businessId);

    return Response.json({ category });
  });
}

// PATCH /api/categories/:id
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  return handle(async () => {
    const authResponse = authGuard(request, {
      requirePermission: PERMISSION.CATEGORY_WRITE,
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

    const result = updateCategorySchema.safeParse(body);
    if (!result.success) throw result.error;

    const category = await categoryService.updateCategory(
      id,
      businessId,
      result.data.name,
    );

    return Response.json({ category });
  });
}

// DELETE /api/categories/:id
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
) {
  return handle(async () => {
    const authResponse = authGuard(request, {
      requirePermission: PERMISSION.CATEGORY_WRITE,
    });
    if (authResponse) return authResponse;

    const businessId = requireBusinessId(request);
    const { id } = await params;

    await categoryService.deleteCategory(id, businessId);

    return new Response(null, { status: 204 });
  });
}
