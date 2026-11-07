import { NextResponse, type NextRequest } from "next/server";
import { handle, parseParams } from "@/lib/http";
import { getGuestTokenFromRequest } from "@/lib/auth/requestHelper";
import { orderService } from "@/service/OrderService";
import { AuthenticationException } from "@/utils/exceptions/http/AuthenticationException";
import { orderIdSchema } from "@/validation/orderSchemas";

// POST /api/orders/:id/cancel (guest): cancels this phone's round while the kitchen hasn't started it.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const guestToken = getGuestTokenFromRequest(request);
    if (!guestToken) throw new AuthenticationException("unauthorized");

    const { id } = await parseParams(params, orderIdSchema);
    const result = await orderService.cancelGuestOrder(id, guestToken);

    return NextResponse.json({
      success: true,
      message: "order cancelled",
      data: result,
    });
  });
}
