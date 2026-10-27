// src/app/api/auth/me/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authGuard } from "@/lib/auth/gaurd"
import { getUserIdFromRequest } from "@/lib/auth/requestHelper";
import { userRepo } from "@/repository/UserRepo";
import { handleRouteError } from "@/utils/handleRouteError";

/**
 * GET /api/auth/me
 *
 * Returns the currently logged-in user's profile from the session cookie.
 * Called by the frontend once per page load to hydrate the session.
 *
 * Requires: valid auth_token cookie (verified by proxy.ts → injects x-user-id)
 * No role or permission required — every authenticated user can call /me.
 *
 * Response 200:
 *   { success: true, data: { userId, businessId, name, email, role, isActive, createdAt } }
 *
 * Errors:
 *   401 — no cookie / expired / invalid JWT (from proxy.ts or authGuard)
 *   404 — userId in JWT no longer exists in DB (userRepo.getItem NotFound)
 *   500 — DB error (DBException)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Auth guard — no role/permission required.
    //    Returns 401 NextResponse if no session; null if allowed.
    const authError = authGuard(request);
    if (authError) return authError;

    // 2. Read userId from the trusted header injected by proxy.ts.
    //    The header value comes from a verified JWT — the client can't forge it.
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 3. Load the user from the DB — throws ItemNotFoundException if deleted.
    const user = await userRepo.getUser(userId);

    // 4. Return only safe fields — never passwordHash, refreshToken, resetPasswordToken.
    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        businessId: user.businessId,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}