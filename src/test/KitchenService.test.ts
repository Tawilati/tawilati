import { beforeEach, describe, expect, it, vi } from "vitest";
import { KitchenService, kitchenService } from "@/service/KitchenService";
import { HttpException } from "@/utils/exceptions/http/HttpException";

vi.mock("@/repository/KitchenRepo", () => ({
  kitchenRepo: {
    findKitchenOrders: vi.fn(),
    findOrderForKitchen: vi.fn(),
    updateOrderStatus: vi.fn(),
  },
}));

import { kitchenRepo } from "@/repository/KitchenRepo";

const mockedKitchenRepo = vi.mocked(kitchenRepo);

async function rejection(promise: Promise<unknown>): Promise<HttpException> {
  const error = await promise.then(
    () => { throw new Error("expected a rejection"); },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(HttpException);
  return error as HttpException;
}

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

  describe("updateKitchenOrderStatus", () => {
    it.each([
      ["NEW", "PREPARING"],
      ["PREPARING", "READY"],
    ] as const)("moves a round from %s to %s", async (from, to) => {
      mockedKitchenRepo.findOrderForKitchen.mockResolvedValue({ id: "order-1", status: from });
      mockedKitchenRepo.updateOrderStatus.mockResolvedValue({ id: "order-1", status: to } as never);

      await expect(
        kitchenService.updateKitchenOrderStatus("order-1", "business-1", to),
      ).resolves.toEqual({ orderId: "order-1", status: to });
      expect(mockedKitchenRepo.findOrderForKitchen).toHaveBeenCalledWith("order-1", "business-1");
      expect(mockedKitchenRepo.updateOrderStatus).toHaveBeenCalledWith("order-1", to);
    });

    it("answers 404 not_found for a round that isn't in this business", async () => {
      mockedKitchenRepo.findOrderForKitchen.mockResolvedValue(null);

      const error = await rejection(
        kitchenService.updateKitchenOrderStatus("order-1", "business-1", "PREPARING"),
      );
      expect([error.status, error.message]).toEqual([404, "not_found"]);
      expect(mockedKitchenRepo.updateOrderStatus).not.toHaveBeenCalled();
    });

    it.each([
      ["NEW", "READY"],
      ["PREPARING", "PREPARING"],
      ["READY", "PREPARING"],
      ["READY", "READY"],
      ["SERVED", "READY"],
      ["CANCELLED", "PREPARING"],
    ] as const)("answers 400 invalid_transition from %s to %s, with no write", async (from, to) => {
      mockedKitchenRepo.findOrderForKitchen.mockResolvedValue({ id: "order-1", status: from });

      const error = await rejection(
        kitchenService.updateKitchenOrderStatus("order-1", "business-1", to),
      );
      expect([error.status, error.message]).toEqual([400, "invalid_transition"]);
      expect(mockedKitchenRepo.updateOrderStatus).not.toHaveBeenCalled();
    });
  });
});
