import { waiterRepo } from "@/repository/WaiterRepo";
import {
  mapToWaiterTableResponse,
  type WaiterTableResponse,
} from "@/types/Waiter";

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
}

export const waiterService = WaiterService.getInstance();