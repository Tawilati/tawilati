import type { NextRequest } from "next/server";
import { getGuestTokenFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { guestSessionService } from "@/service/GuestSessionService";
import { AuthenticationException } from "@/utils/exceptions/http/AuthenticationException";
import { guestTokenSchema } from "@/validation/orderSchemas";

// Guest route: the phone's own token, expired or not, buys it 2 more hours while the tab is open.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const guestToken = guestTokenSchema.safeParse(getGuestTokenFromRequest(request));
    if (!guestToken.success) throw new AuthenticationException("unauthorized");

    const guestSession = await guestSessionService.RenewGuestSession(guestToken.data);

    return Response.json({
      success: true,
      message: "guest session renewed",
      data: guestSession,
    });
  });
}
