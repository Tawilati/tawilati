
import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseParams } from "@/lib/http";
import { tableService } from "@/service/TableService";
import { PERMISSION } from "@/types/Roles";
import { tableIdSchema } from "@/validation/tableSchemas";

// POST /api/tables/:id/enable (OWNER)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const denied = authGuard(request, {
      requirePermission: PERMISSION.TABLE_UPDATE,
    });
    if (denied) return denied;

    const { id } = await parseParams(params, tableIdSchema);

    const table = await tableService.enableTable(
      getBusinessIdFromRequest(request)!,
      id,
    );

    return NextResponse.json({
      success: true,
      message: "table enabled",
      data: table,
    });
  });
}
