import type { NextRequest } from "next/server";
import { handle, parseBody } from "@/lib/http";
import { getGuestTokenFromRequest } from "@/lib/auth/requestHelper";
import { orderService } from "@/service/OrderService";
import { AuthenticationException } from "@/utils/exceptions/http/AuthenticationException";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import {
  guestTokenSchema,
  idempotencyKeySchema,
  submitOrderSchema,
} from "@/validation/orderSchemas";

// Guest route: the proxy lets it through, the guest token is checked against GuestSession here.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const guestToken = guestTokenSchema.safeParse(getGuestTokenFromRequest(request));
    if (!guestToken.success) throw new AuthenticationException("unauthorized");

    const idempotencyKey = idempotencyKeySchema.safeParse(
      request.headers.get("idempotency-key"),
    );
    if (!idempotencyKey.success) throw new BadRequestException("idempotency_key_required");

    const { items } = await parseBody(request, submitOrderSchema);

    const { created, order } = await orderService.createOrder({
      guestToken: guestToken.data,
      idempotencyKey: idempotencyKey.data,
      items,
    });

    // 201 for a new round, 200 when the same submission is retried (no new kitchen ticket).
    return Response.json(
      {
        success: true,
        message: created ? "order submitted" : "order already submitted",
        data: order,
      },
      { status: created ? 201 : 200 },
    );
  });
}
