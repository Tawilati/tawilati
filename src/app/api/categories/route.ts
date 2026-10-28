import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody } from "@/lib/http";
import { categoryService } from "@/service/CategoryService";
import { PERMISSION } from "@/types/Roles";
import { createCategorySchema } from "@/validation/categorySchemas";

// GET /api/categories (staff): every category in the business, with its item count.
export async function GET(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.CATEGORY_READ });
    if (denied) return denied;

    // The guard has checked the identity headers, so the business id is there.
    const categories = await categoryService.listCategories(getBusinessIdFromRequest(request)!);
    return NextResponse.json({ success: true, message: "categories list", data: categories });
  });
}

// POST /api/categories (OWNER): add a category; a name already used in the business is a 409.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.CATEGORY_WRITE });
    if (denied) return denied;

    const { name } = await parseBody(request, createCategorySchema);
    const category = await categoryService.createCategory(getBusinessIdFromRequest(request)!, name);
    return NextResponse.json({ success: true, message: "category created", data: category }, { status: 201 });
  });
}
