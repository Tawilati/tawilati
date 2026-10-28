
import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody, parseParams } from "@/lib/http";
import { tableService } from "@/service/TableService";
import { PERMISSION } from "@/types/Roles";
import {
  tableIdSchema,
  updateTableSchema,
} from "@/validation/tableSchemas";

// PATCH /api/tables/:id (OWNER): update a table's label.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const denied = authGuard(request, {
      requirePermission: PERMISSION.TABLE_WRITE,
    });
    if (denied) return denied;

    const { id } = await parseParams(params, tableIdSchema);
    const patch = await parseBody(request, updateTableSchema);

    const table = await tableService.updateTable(
      getBusinessIdFromRequest(request)!,
      id,
      patch,
    );

    return NextResponse.json({
      success: true,
      message: "table updated",
      data: table,
    });
  });
}
