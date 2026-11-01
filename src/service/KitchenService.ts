import { kitchenRepo } from "@/repository/KitchenRepo";
import {
  mapToKitchenOrdersResponse,
  type KitchenOrdersResponse,
} from "@/types/Kitchen";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

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
    const orders = await kitchenRepo.findKitchenOrders(businessId);
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
    throw new NotFoundException("order_not_found");
  }

  // 2. Validate the transition (F-04: reject invalid transitions)
  const validTransition =
    (order.status === "NEW" && newStatus === "PREPARING") ||
    (order.status === "PREPARING" && newStatus === "READY");

  if (!validTransition) {
    throw new ConflictException(
      `invalid_transition_from_${order.status.toLowerCase()}_to_${newStatus.toLowerCase()}`,
    );
  }

  // 3. Update the status
  const updatedOrder = await kitchenRepo.updateOrderStatus(orderId, newStatus);

  return {
    orderId: updatedOrder.id,
    status: updatedOrder.status,
  };
}

}

export const kitchenService = KitchenService.getInstance();