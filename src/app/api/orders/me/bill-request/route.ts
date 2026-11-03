import { NextResponse, type NextRequest } from "next/server";
import { getGuestTokenFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { orderService } from "@/service/OrderService";
import { AuthenticationException } from "@/utils/exceptions/http/AuthenticationException";
import { guestTokenSchema } from "@/validation/orderSchemas";

// POST /api/orders/me/bill-request (guest): "Ask for the bill". No body; the tab comes from the token.
// The proxy treats everything under /api/orders/me as a guest route.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const guestToken = guestTokenSchema.safeParse(getGuestTokenFromRequest(request));
    if (!guestToken.success) throw new AuthenticationException("unauthorized");

    const result = await orderService.requestBill(guestToken.data);

    return NextResponse.json({ success: true, message: "bill requested", data: result });
  });
}
