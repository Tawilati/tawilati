import { NextResponse, type NextRequest } from "next/server";
import { handle } from "@/lib/http";
import { getGuestTokenFromRequest } from "@/lib/auth/requestHelper";
import { orderService } from "@/service/OrderService";
import { AuthenticationException } from "@/utils/exceptions/http/AuthenticationException";

// POST /api/orders/:id/cancel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const guestToken = getGuestTokenFromRequest(request);
    if (!guestToken) throw new AuthenticationException("unauthorized");

    const { id } = await params;
    const result = await orderService.cancelGuestOrder(id, guestToken);

    return NextResponse.json({
      success: true,
      message: "order cancelled",
      data: result,
    });
  });
}