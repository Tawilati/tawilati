import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest, getUserIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody } from "@/lib/http";
import { mcpTokenService } from "@/service/McpTokenService";
import { PERMISSION } from "@/types/Roles";
import { createMcpTokenSchema } from "@/validation/mcpTokenSchemas";

// GET /api/mcp-tokens (OWNER): every token in the business, without the secret.
export async function GET(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.MCP_TOKEN_WRITE });
    if (denied) return denied;

    const tokens = await mcpTokenService.list(getBusinessIdFromRequest(request)!);
    return NextResponse.json({ success: true, message: "mcp tokens list", data: tokens });
  });
}

// POST /api/mcp-tokens (OWNER): the raw token appears in this response and never again.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.MCP_TOKEN_WRITE });
    if (denied) return denied;

    const { name } = await parseBody(request, createMcpTokenSchema);
    const token = await mcpTokenService.create(
      getBusinessIdFromRequest(request)!,
      getUserIdFromRequest(request)!,
      name,
    );
    return NextResponse.json({ success: true, message: "mcp token created", data: token }, { status: 201 });
  });
}
