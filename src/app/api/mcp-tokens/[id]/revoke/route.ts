import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseParams } from "@/lib/http";
import { mcpTokenService } from "@/service/McpTokenService";
import { PERMISSION } from "@/types/Roles";
import { mcpTokenIdSchema } from "@/validation/mcpTokenSchemas";

// POST /api/mcp-tokens/:id/revoke (OWNER): stops the token working; 404 mcp_token_not_found if it isn't an active token of this business.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.MCP_TOKEN_WRITE });
    if (denied) return denied;

    const { id } = await parseParams(params, mcpTokenIdSchema);
    await mcpTokenService.revoke(id, getBusinessIdFromRequest(request)!);
    return NextResponse.json({ success: true, message: "mcp token revoked" });
  });
}
