import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody, parseParams } from "@/lib/http";
import { categoryService } from "@/service/CategoryService";
import { PERMISSION } from "@/types/Roles";
import { categoryIdSchema, updateCategorySchema } from "@/validation/categorySchemas";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/categories/:id (staff)
export async function GET(request: NextRequest, { params }: RouteContext) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.CATEGORY_READ });
    if (denied) return denied;

    const { id } = await parseParams(params, categoryIdSchema);
    const category = await categoryService.getCategory(id, getBusinessIdFromRequest(request)!);
    return NextResponse.json({ success: true, message: "category", data: category });
  });
}

// PATCH /api/categories/:id (OWNER): rename.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.CATEGORY_WRITE });
    if (denied) return denied;

    const { id } = await parseParams(params, categoryIdSchema);
    const { name } = await parseBody(request, updateCategorySchema);
    const category = await categoryService.updateCategory(id, getBusinessIdFromRequest(request)!, name);
    return NextResponse.json({ success: true, message: "category updated", data: category });
  });
}

// DELETE /api/categories/:id (OWNER): 204; blocked with 409 category_has_items while it has items (archived ones count).
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.CATEGORY_WRITE });
    if (denied) return denied;

    const { id } = await parseParams(params, categoryIdSchema);
    await categoryService.deleteCategory(id, getBusinessIdFromRequest(request)!);
    return new Response(null, { status: 204 });
  });
}
