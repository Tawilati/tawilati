import { NextResponse, type NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest, getUserIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseBody } from "@/lib/http";
import { oauthService } from "@/service/OAuthService";
import { PERMISSION } from "@/types/Roles";
import { authorizeDecisionSchema } from "@/validation/oauthSchemas";

// POST /api/oauth/authorize (OWNER): the owner's Allow or Cancel on the /oauth/authorize screen.
// Answers { data: { redirectTo } }: the assistant's address with a one-time code, or with
// error=access_denied. invalid_client / invalid_redirect_uri (400) if the request was tampered with.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, { requirePermission: PERMISSION.MCP_TOKEN_WRITE });
    if (denied) return denied;

    const decision = await parseBody(request, authorizeDecisionSchema);
    const redirectTo = await oauthService.decide(decision, {
      userId: getUserIdFromRequest(request)!,
      businessId: getBusinessIdFromRequest(request)!,
    });
    return NextResponse.json({ success: true, message: "oauth decision recorded", data: { redirectTo } });
  });
}
