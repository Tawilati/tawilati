import { guestSessionRepo } from "@/repository/GuestSessionRepo";
import { orderRepo } from "@/repository/OrderRepo";
import { submissionRepo } from "@/repository/SubmissionRepo";
import { menuItemRepo } from "@/repository/MenuItemsRepo";
import { tableSessionRepo } from "@/repository/TabelSession";
import { Prisma } from "@/app/generated/prisma/client";
import { BillSplitResponse, GuestBillResponse, mapToGuestBillResponse, mapToOrderResponse, SubmitOrderInput, SubmitOrderResult } from "@/types/Order";
import {
  AuthenticationException,
  ExpiredTokenException,
} from "@/utils/exceptions/http/AuthenticationException";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { HttpException } from "@/utils/exceptions/http/HttpException";
import { prisma } from "@/lib/db";
import logger from "@/utils/logger";
import { hashOrderLines } from "@/utils/OrderHash";
import { Decimal } from "@/app/generated/prisma/internal/prismaNamespaceBrowser";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

export class OrderService {
  private static instance: OrderService;

  private constructor() {}

  static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService();
    }
    return OrderService.instance;
  }

  async createOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
    // ─────────────────────────────────────────────────────────
    // STEP 1: Guest authentication
    // ─────────────────────────────────────────────────────────
    const guest = await guestSessionRepo.FindByToken(input.guestToken);

    if (!guest) {
      logger.error("unauthorized");
      throw new AuthenticationException("unauthorized");
    }

    if (guest.expiresAt < new Date()) {
      logger.error("session expired");
      throw new ExpiredTokenException();
    }

    if (guest.revokedAt) {
      logger.error("the waiter closed the table session");
      throw new HttpException(401, "guest_session_revoked");
    }

    if (guest.session.status !== "OPEN") {
      logger.error("table session is closed and bill is paid");
      throw new ConflictException("table_session_closed");
    }
    if (guest.status !== "ACTIVE") {
  throw new HttpException(403, "guest_session_pending_approval");
}

    // ─────────────────────────────────────────────────────────
    // STEP 2: Idempotency check
    // ─────────────────────────────────────────────────────────
    if (!input.idempotencyKey) {
      logger.error("idempotency key is required");
      throw new BadRequestException("idempotency_key_required");
    }

    const payloadHash = hashOrderLines(input.items);

    const submittedOrder = await submissionRepo.FindByKey(
      guest.session.businessId,
      input.idempotencyKey,
    );

    if (submittedOrder) {
      // Same key + same payload → retry
      if (submittedOrder.payloadHash === payloadHash) {
        if (!submittedOrder.orderId) {
          throw new HttpException(500, "order_link_corrupted");
        }

        const originalOrder = await orderRepo.findByIdWithRelations(
          submittedOrder.orderId,
        );

        if (!originalOrder) {
          logger.error("there is no order here");
          throw new HttpException(500, "order_link_corrupted");
        }

        return {
          created: false,
          order: mapToOrderResponse({
            submissionId: submittedOrder.id,
            order: originalOrder,
          }),
        };
      }

      // Same key + different payload → conflict
      throw new ConflictException("idempotency_key_mismatch");
    }

    // ─────────────────────────────────────────────────────────
    // STEP 3: Validate items + compute totals
    // ─────────────────────────────────────────────────────────
    const menuItemIds = [...new Set(input.items.map((i) => i.menuItemId))];
    const menuItems = await menuItemRepo.findManyByIds(
      guest.session.businessId,
      menuItemIds,
    );

    if (menuItems.length !== menuItemIds.length) {
      logger.error("one or more menu items not found in this business");
      throw new HttpException(400, "menu_item_not_found");
    }

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    for (const item of input.items) {
      if (item.qty < 1) {
        logger.error(`invalid quantity: ${item.qty}`);
        throw new HttpException(400, "invalid_quantity");
      }

      const mi = menuItemMap.get(item.menuItemId);
      if (!mi) {
        logger.error(`menu item not found: ${item.menuItemId}`);
        throw new HttpException(400, "menu_item_not_found");
      }

      if (mi.archivedAt) {
        logger.error(`menu item archived: ${item.menuItemId}`);
        throw new ConflictException("menu_item_archived");
      }

      if (mi.soldOut) {
        logger.error(`menu item sold out: ${item.menuItemId}`);
        throw new ConflictException("menu_item_sold_out");
      }
    }

    const rate = await menuItemRepo.findBusinessExchangeRate(
      guest.session.businessId,
    );

    if (!rate) {
      logger.error("business not found");
      throw new HttpException(500, "business_not_found");
    }

    // Money stays in Decimal, never float
    let totalUSD = new Prisma.Decimal(0);
    let totalLBP = new Prisma.Decimal(0);

    const lines = input.items.map((item) => {
      const mi = menuItemMap.get(item.menuItemId)!;

      totalUSD = totalUSD.plus(mi.priceUSD.times(item.qty));
      totalLBP = totalLBP.plus(mi.priceLBP.times(item.qty));

      return {
        menuItemId: item.menuItemId,
        qty: item.qty,
        priceUSD: mi.priceUSD,
        priceLBP: mi.priceLBP,
        rateSnapshot: rate,
      };
    });

    // ─────────────────────────────────────────────────────────
    // STEP 4: Save submission + order + bill totals in one transaction
    // ─────────────────────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      const submission = await submissionRepo.create(
        {
          businessId: guest.session.businessId,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
        },
        tx,
      );

      const order = await orderRepo.create(
        {
          businessId: guest.session.businessId,
          sessionId: guest.sessionId,
          tableId: guest.session.tableId,
          guestSessionId: guest.id,
          totalUSD,
          totalLBP,
          lines,
        },
        tx,
      );

      await submissionRepo.linkToOrder(submission.id, order.id, tx);
      await tableSessionRepo.updateTotals(
        guest.sessionId,
        totalUSD,
        totalLBP,
        tx,
      );
      await guestSessionRepo.extend(
  guest.id,
  new Date(Date.now() + 2 * 60 * 60 * 1000),
  tx,
);
      return { submission, order };
    });

    return {
      created: true,
      order: mapToOrderResponse({
        submissionId: result.submission.id,
        order: result.order,
      }),
    };
  }
   async getGuestOrders(guestToken: string): Promise<GuestBillResponse> {
    // ─────────────────────────────────────────────────────────
    // STEP 1: Find the guest session (same as createOrder)
    // ─────────────────────────────────────────────────────────
    const guest = await guestSessionRepo.FindByToken(guestToken);

    if (!guest) {
      logger.error("unauthorized");
      throw new AuthenticationException("unauthorized");
    }

    if (guest.expiresAt < new Date()) {
      logger.error("session expired");
      throw new ExpiredTokenException();
    }

    if (guest.revokedAt) {
      logger.error("guest session revoked");
      throw new HttpException(401, "guest_session_revoked");
    }

    // ─────────────────────────────────────────────────────────
    // STEP 2: Fetch the full bill (orders + table totals)
    // ─────────────────────────────────────────────────────────
    // The repository query should include session, table, orders, orderLines, menuItem
    const bill = await guestSessionRepo.getGuestBill(guest.id);

    if (!bill) {
      throw new HttpException(500, "guest_bill_not_found");
    }

    // ─────────────────────────────────────────────────────────
    // STEP 3: Map to the clean response
    // ─────────────────────────────────────────────────────────
    return mapToGuestBillResponse(bill);
  }

  // "Ask for the bill" from the guest's phone: the waiter's tile for the table turns yellow. Same token rules
  // as getGuestOrders; a closed tab is 409. Asking twice keeps the first time.
  async requestBill(guestToken: string): Promise<{ billRequestedAt: string }> {
    const guest = await guestSessionRepo.FindByToken(guestToken);

    if (!guest) {
      throw new AuthenticationException("unauthorized");
    }
    if (guest.expiresAt < new Date()) {
      throw new ExpiredTokenException();
    }
    if (guest.revokedAt) {
      throw new HttpException(401, "guest_session_revoked");
    }
    if (guest.session.status !== "OPEN") {
      throw new ConflictException("table_session_closed");
    }

    const billRequestedAt = await tableSessionRepo.requestBill(guest.sessionId);
    // The tab closed between the check above and the update.
    if (!billRequestedAt) {
      throw new ConflictException("table_session_closed");
    }
    return { billRequestedAt: billRequestedAt.toISOString() };
  }
  async splitBill(
  guestToken: string,
  splitCount: number,
): Promise<BillSplitResponse> {
  // 1. Authenticate the guest
  const guest = await guestSessionRepo.FindByToken(guestToken);
  if (!guest) throw new AuthenticationException("unauthorized");
  if (guest.revokedAt) throw new HttpException(401, "guest_session_revoked");
  if (guest.expiresAt < new Date()) throw new ExpiredTokenException();
  if (guest.session.status !== "OPEN") {
    throw new ConflictException("table_session_closed");
  }

  // 2. Validate split count
  if (splitCount < 1 || splitCount > 50) {
    throw new BadRequestException("invalid_split_count");
  }

  // 3. Compute per-person amounts (no storage)
  const totalUSD = new Decimal(guest.session.totalUSD);
  const totalLBP = new Decimal(guest.session.totalLBP);

  const perPersonUSD = totalUSD.div(splitCount).toFixed(2);
  const perPersonLBP = totalLBP.div(splitCount).toFixed(2);

  // 4. Return the split (nothing is saved)
  return {
    sessionId: guest.sessionId,
    tableLabel: guest.session.table.label,
    totalUSD: totalUSD.toFixed(2),
    totalLBP: totalLBP.toFixed(2),
    splitCount,
    perPersonUSD,
    perPersonLBP,
  };
}
async cancelGuestOrder(
  orderId: string,
  guestToken: string,
): Promise<{ orderId: string; status: string }> {
  // 1. Authenticate the guest
  const guest = await guestSessionRepo.FindByToken(guestToken);
  if (!guest) throw new AuthenticationException("unauthorized");
  if (guest.revokedAt) throw new HttpException(401, "guest_session_revoked");
  if (guest.expiresAt < new Date()) throw new ExpiredTokenException();
  if (guest.session.status !== "OPEN") {
    throw new ConflictException("table_session_closed");
  }

  // 2. Find the order (ensuring it belongs to THIS guest)
  const order = await orderRepo.findGuestOrderForCancel(orderId, guest.id);
  if (!order) throw new NotFoundException("order_not_found");

  // 3. Only a round the kitchen hasn't started can be cancelled.
  if (order.status === "CANCELLED") {
    throw new ConflictException("order_already_cancelled");
  }
  if (order.status !== "NEW") {
    throw new ConflictException("cannot_cancel_order_already_in_progress");
  }

  // 4. Transaction: cancel + take it off the tab. The cancel only lands if the round is still NEW, so a kitchen
  // tapping Start at the same moment wins or loses as a whole (the totals are untouched when it wins).
  const result = await prisma.$transaction(async (tx) => {
    const cancelled = await orderRepo.cancelOrderAndUpdateBill(
      order.id,
      order.sessionId,
      order.totalUSD,
      order.totalLBP,
      tx,
    );
    if (!cancelled) throw new ConflictException("cannot_cancel_order_already_in_progress");
    return { orderId: order.id, status: "CANCELLED" };
  });

  return result;
}
}

export const orderService = OrderService.getInstance();