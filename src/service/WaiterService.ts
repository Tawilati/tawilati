import { prisma } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import { menuItemRepo } from "@/repository/MenuItemsRepo";
import { waiterRepo } from "@/repository/WaiterRepo";
import {
  CloseTabInput,
  CloseTabResponse,
  mapToWaiterBillResponse,
  mapToWaiterTableResponse,
  WaiterBillResponse,
  type WaiterTableResponse,
} from "@/types/Waiter";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

export class WaiterService {
  private static instance: WaiterService;

  private constructor() {}

  static getInstance(): WaiterService {
    if (!WaiterService.instance) {
      WaiterService.instance = new WaiterService();
    }
    return WaiterService.instance;
  }

  async getActiveTables(businessId: string): Promise<WaiterTableResponse[]> {
    const tables = await waiterRepo.findActiveTables(businessId);
    return tables.map(mapToWaiterTableResponse);
  }
  async markOrderServed(
  orderId: string,
  businessId: string,
): Promise<{ orderId: string; status: string }> {
  // 1. Find the order (scoped to business)
  const order = await waiterRepo.findOrderForWaiter(orderId, businessId);

  if (!order) {
    throw new NotFoundException("not_found");
  }

  // 2. Validate transition (F-04: only READY → SERVED)
  if (order.status !== "READY") {
    throw new BadRequestException("invalid_transition");
  }

  // 3. Update
  const updated = await waiterRepo.markOrderAsServed(orderId);

  return {
    orderId: updated.id,
    status: updated.status,
  };
}
async getBill(
  sessionId: string,
  businessId: string,
): Promise<WaiterBillResponse> {
  const bill = await waiterRepo.findBillBySessionId(sessionId, businessId);
  if (!bill) {
    throw new NotFoundException("not_found");
  }
  return mapToWaiterBillResponse(bill);
}

async closeTab(
  sessionId: string,
  businessId: string,
  waiterId: string,
  input: CloseTabInput,
): Promise<CloseTabResponse> {
  // 1. Fetch the session
  const session = await waiterRepo.findSessionForClose(sessionId, businessId);
  if (!session) {
    throw new NotFoundException("not_found");
  }

  if (session.status === "CLOSED") {
    throw new ConflictException("table_session_closed");
  }

  // 2. The business's exchange rate, to count LBP received towards the bill
  const exchangeRate = await menuItemRepo.findBusinessExchangeRate(businessId);
  if (!exchangeRate) throw new NotFoundException("not_found");
  const rate = Number(exchangeRate);

  // 3. Validate payment (convert everything to USD): USD and LBP together must cover the bill
  const billUSD = Number(session.totalUSD);
  const receivedUSD = input.amountReceivedUSD;
  const receivedLBPAsUSD = input.amountReceivedLBP / rate;
  const totalReceivedUSD = receivedUSD + receivedLBPAsUSD;

  if (totalReceivedUSD < billUSD - 0.01) {
    throw new BadRequestException("insufficient_payment");
  }

  // 4. Compute change (only if overpaid)
  const changeUSD = Math.max(0, totalReceivedUSD - billUSD);
  const changeLBP = changeUSD * rate;

  // 5. Determine how much to record in the Payment table
  // If the guest paid more than the bill, we only record the bill amount
  // (the change is not revenue).
  let paymentUSD: Prisma.Decimal;
  let paymentLBP: Prisma.Decimal;

  if (receivedUSD >= billUSD) {
    paymentUSD = new Prisma.Decimal(billUSD);
    paymentLBP = new Prisma.Decimal(0);
  } else {
    paymentUSD = new Prisma.Decimal(receivedUSD);
    paymentLBP = new Prisma.Decimal((billUSD - receivedUSD) * rate);
  }
  // The maths above is in floats ((12.10 - 10) × 89000 = 186899.99999999997): record whole cents, half up.
  paymentUSD = paymentUSD.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  paymentLBP = paymentLBP.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  // 6. Transaction. The tab is closed first, and only while it is still OPEN, so of two closes racing on
  // one tab the second gets 409 and records nothing. Any throw below rolls the close back.
  const paymentId = await prisma.$transaction(async (tx) => {
    const closed = await waiterRepo.closeIfOpen(
      {
        sessionId,
        businessId,
        amountPaidUSD: paymentUSD,
        amountPaidLBP: paymentLBP,
      },
      tx,
    );
    if (!closed) {
      throw new ConflictException("table_session_closed");
    }

    // Every round must be served (or cancelled) before the bill is settled.
    if ((await waiterRepo.countUnservedOrders(sessionId, tx)) > 0) {
      throw new ConflictException("tab_not_settleable");
    }

    // A tab with nothing on it (a guest scanned but never ordered) closes without a payment.
    let payment: { id: string } | null = null;
    if (!session.totalUSD.isZero() || !session.totalLBP.isZero()) {
      payment = await waiterRepo.createPayment(
        {
          sessionId,
          amountUSD: paymentUSD,
          amountLBP: paymentLBP,
          method: input.method,
          recordedById: waiterId,
        },
        tx,
      );
    }

    await waiterRepo.revokeGuestSessions(sessionId, tx);
    return payment?.id ?? null;
  });

  // 7. Return the receipt
  return {
    sessionId: session.id,
    status: "CLOSED",
    totalUSD: session.totalUSD.toFixed(2),
    totalLBP: session.totalLBP.toFixed(2),
    amountPaidUSD: paymentUSD.toFixed(2),
    amountPaidLBP: paymentLBP.toFixed(2),
    amountReceivedUSD: receivedUSD.toFixed(2),
    amountReceivedLBP: input.amountReceivedLBP.toFixed(2),
    changeUSD: changeUSD.toFixed(2),
    changeLBP: changeLBP.toFixed(2),
    paymentId,
  };
}
}

export const waiterService = WaiterService.getInstance();