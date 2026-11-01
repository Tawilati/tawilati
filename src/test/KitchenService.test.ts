import { beforeEach, describe, expect, it, vi } from "vitest";
import { KitchenService, kitchenService } from "@/service/KitchenService";

vi.mock("@/repository/KitchenRepo", () => ({
  kitchenRepo: {
    findKitchenOrders: vi.fn(),
  },
}));

import { kitchenRepo } from "@/repository/KitchenRepo";

const mockedKitchenRepo = vi.mocked(kitchenRepo);

describe("KitchenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the same singleton instance", () => {
    expect(KitchenService.getInstance()).toBe(kitchenService);
  });

  it("loads and maps kitchen orders for the requested business", async () => {
    mockedKitchenRepo.findKitchenOrders.mockResolvedValue([]);

    await expect(kitchenService.getKitchenOrders("business-1")).resolves.toEqual([]);
    expect(mockedKitchenRepo.findKitchenOrders).toHaveBeenCalledWith("business-1");
  });
});
