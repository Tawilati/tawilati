import { kitchenRepo } from "@/repository/KitchenRepo";
import {
  mapToKitchenOrdersResponse,
  type KitchenOrdersResponse,
} from "@/types/Kitchen";

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
}

export const kitchenService = KitchenService.getInstance();