import { getGuestTokenFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { orderService } from "@/service/OrderService";
import { AuthenticationException } from "@/utils/exceptions/http/AuthenticationException";
import { guestTokenSchema } from "@/validation/orderSchemas";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const guestToken = guestTokenSchema.safeParse(getGuestTokenFromRequest(request));
    if (!guestToken.success) throw new AuthenticationException("unauthorized");

    const bill = await orderService.getGuestOrders(guestToken.data);

    return NextResponse.json({ success: true, message: "guest bill", data: bill });
  });
}