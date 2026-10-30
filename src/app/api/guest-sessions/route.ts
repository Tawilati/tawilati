import type { NextRequest } from "next/server";
import { handle, parseBody } from "@/lib/http";
import { guestSessionService } from "@/service/GuestSessionService";
import { createGuestSessionSchema } from "@/validation/guestSessionSchemas";

// Public route: a scanned table QR code grants a guest session.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const { qrToken } = await parseBody(request, createGuestSessionSchema);
    const guestSession = await guestSessionService.CreateGuestSession(qrToken);

    return Response.json(
      {
        success: true,
        message: "guest session created",
        data: guestSession,
      },
      { status: 201 },
    );
  });
}
