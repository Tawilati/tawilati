import { NextResponse, type NextRequest } from "next/server";
import { handle } from "@/lib/http";
import { getUserIdFromRequest } from "@/lib/auth/requestHelper";
import { authService } from "@/service/AuthService";

// Staff only: src/proxy.ts has already checked the session (no session → 401, cookies cleared there).
export async function POST(request: NextRequest) {
  return handle(async () => {
    const response = NextResponse.json({ success: true, message: "signed_out" });
    const userId = getUserIdFromRequest(request);
    if (userId) await authService.logout(response, userId);
    else authService.clearAuthCookies(response);
    return response;
  });
}
