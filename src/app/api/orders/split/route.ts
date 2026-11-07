import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/http";
import { getGuestTokenFromRequest } from "@/lib/auth/requestHelper";
import { orderService } from "@/service/OrderService";
import { AuthenticationException } from "@/utils/exceptions/http/AuthenticationException";

const schema = z.object({
  splitCount: z.number().int().min(1).max(50),
});

// POST /api/orders/split
export async function POST(request: NextRequest) {
  return handle(async () => {
    const guestToken = getGuestTokenFromRequest(request);
    if (!guestToken) throw new AuthenticationException("unauthorized");

    const { splitCount } = await parseBody(request, schema);
    const result = await orderService.splitBill(guestToken, splitCount);

    return NextResponse.json({
      success: true,
      message: "bill split",
      data: result,
    });
  });
}