
import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody } from "@/lib/http";
import { tableService } from "@/service/TableService";
import { PERMISSION } from "@/types/Roles";
import { createTableSchema } from "@/validation/tableSchemas";

// POST /api/tables — OWNER
export async function POST(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, {
      requirePermission: PERMISSION.TABLE_WRITE,
    });
    if (denied) return denied;

    const input = await parseBody(request, createTableSchema);
    const businessId = getBusinessIdFromRequest(request)!;

    const table = await tableService.createTable(businessId, input);

    return NextResponse.json(
      {
        success: true,
        message: "table created",
        data: table,
      },
      { status: 201 },
    );
  });
}

// GET /api/tables — users with TABLE_READ permission
export async function GET(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, {
      requirePermission: PERMISSION.TABLE_READ,
    });
    if (denied) return denied;

    const businessId = getBusinessIdFromRequest(request)!;
    const tables = await tableService.listTables(businessId);

    return NextResponse.json({
      success: true,
      message: "table list",
      data: tables,
    });
  });
}
