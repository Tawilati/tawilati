import { NextResponse, type NextRequest } from "next/server";
import { handle } from "@/lib/http";
import { getGuestTokenFromRequest } from "@/lib/auth/requestHelper";
import { guestSessionRepo } from "@/repository/GuestSessionRepo";
import { AuthenticationException } from "@/utils/exceptions/http/AuthenticationException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const token = getGuestTokenFromRequest(request);
    if (!token) throw new AuthenticationException("unauthorized");

    const guest = await guestSessionRepo.FindByToken(token);
    if (!guest) throw new NotFoundException("guest_not_found");

    return NextResponse.json({
      success: true,
      data: {
        status: guest.status,
        sessionId: guest.sessionId,
        tableLabel: guest.session.table.label,
        expiresAt: guest.expiresAt,
        // False once the tab closed (closing revokes every session on it, a pending one too): the phone
        // waiting for approval then starts over on the table's next tab instead of waiting forever.
        tabOpen: guest.session.status === "OPEN" && !guest.revokedAt,
      },
    });
  });
}