import { kitchenRepo } from "@/repository/KitchenRepo";
import {
  mapToKitchenOrdersResponse,
  type KitchenOrdersResponse,
} from "@/types/Kitchen";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

// A round the guest cancelled stays on the kitchen screen, crossed out, for this long.
export const CANCELLED_VISIBLE_MS = 60_000;

export class KitchenService {
  private static instance: KitchenService;

  private constructor() {}

  static getInstance(): KitchenService {
    if (!KitchenService.instance) {
      KitchenService.instance = new KitchenService();
    }

    return KitchenService.instance;
  }

  async getKitchenOrders(businessId: string): Promise<KitchenOrdersResponse> {
    const orders = await kitchenRepo.findKitchenOrders(businessId, new Date(Date.now() - CANCELLED_VISIBLE_MS));
    return mapToKitchenOrdersResponse(orders);
  }
  

async updateKitchenOrderStatus(
  orderId: string,
  businessId: string,
  newStatus: "PREPARING" | "READY",
) {
  // 1. Find the order (scoped to the business)
  const order = await kitchenRepo.findOrderForKitchen(orderId, businessId);

  if (!order) {
    throw new NotFoundException("not_found");
  }

  if (order.status === "CANCELLED") {
    throw new ConflictException("order_cancelled");
  }

  // 2. Validate the transition (F-04: reject invalid transitions)
  const validTransition =
    (order.status === "NEW" && newStatus === "PREPARING") ||
    (order.status === "PREPARING" && newStatus === "READY");

  if (!validTransition) {
    throw new BadRequestException("invalid_transition");
  }

  // 3. Update the status, only if nobody changed it since the read: a guest cancelling the round, or another
  // kitchen screen moving it, at the same moment. Exactly one of them wins.
  const updated = await kitchenRepo.updateOrderStatus(orderId, order.status, newStatus);
  if (!updated) {
    const now = await kitchenRepo.findOrderForKitchen(orderId, businessId);
    if (now?.status === "CANCELLED") throw new ConflictException("order_cancelled");
    throw new BadRequestException("invalid_transition");
  }

  return { orderId, status: newStatus };
}

}

export const kitchenService = KitchenService.getInstance();