import prisma from "@/lib/db";
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
    throw new NotFoundException("order_not_found");
  }

  // 2. Validate transition (F-04: only READY → SERVED)
  if (order.status !== "READY") {
    throw new ConflictException(
      `invalid_transition_from_${order.status.toLowerCase()}_to_served`,
    );
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
    throw new NotFoundException("session_not_found");
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
    throw new NotFoundException("session_not_found");
  }

  if (session.status === "CLOSED") {
    throw new ConflictException("session_already_closed");
  }

  // 2. Validate payment amount
  const billUSD = Number(session.totalUSD);
  const billLBP = Number(session.totalLBP);
  const receivedUSD = input.amountReceivedUSD;
  const receivedLBP = input.amountReceivedLBP;

  if (receivedUSD < billUSD && receivedLBP < billLBP) {
    throw new BadRequestException("insufficient_payment");
  }

  // 3. Compute change
  let changeUSD = 0;
  let changeLBP = 0;

  if (input.method === "CASH") {
    changeUSD = Math.max(0, receivedUSD - billUSD);
    changeLBP = Math.max(0, receivedLBP - billLBP);
  }
  // Card: change = 0, exact bill amount is charged

  // 4. Transaction
  const result = await prisma.$transaction(async (tx) => {
    return await waiterRepo.recordPaymentAndClose(
      {
        sessionId,
        totalUSD: session.totalUSD,
        totalLBP: session.totalLBP,
        method: input.method,
        recordedById: waiterId,
      },
      tx,
    );
  });

  // 5. Return the receipt
  return {
    sessionId: result.session.id,
    status: result.session.status,
    totalUSD: result.session.totalUSD.toFixed(2),
    totalLBP: result.session.totalLBP.toFixed(2),
    amountPaidUSD: result.session.amountPaidUSD.toFixed(2),
    amountPaidLBP: result.session.amountPaidLBP.toFixed(2),
    amountReceivedUSD: receivedUSD.toFixed(2),
    amountReceivedLBP: receivedLBP.toFixed(2),
    changeUSD: changeUSD.toFixed(2),
    changeLBP: changeLBP.toFixed(2),
    paymentId: result.payment.id,
  };
}
}

export const waiterService = WaiterService.getInstance();