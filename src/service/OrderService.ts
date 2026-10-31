import { guestSessionRepo } from "@/repository/GuestSessionRepo";
import { orderRepo } from "@/repository/OrderRepo";
import { submissionRepo } from "@/repository/SubmissionRepo";
import { menuItemRepo } from "@/repository/MenuItemsRepo";
import { tableSessionRepo } from "@/repository/TabelSession";
import { Prisma } from "@/app/generated/prisma/client";
import { mapToOrderResponse, SubmitOrderInput, SubmitOrderResult } from "@/types/Order";
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
}

export const orderService = OrderService.getInstance();