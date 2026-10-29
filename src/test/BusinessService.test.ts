import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";

const { businessRepo, menuItemRepo } = vi.hoisted(() => ({
  businessRepo: {
    getById: vi.fn(),
    updateSettings: vi.fn(),
  },
  menuItemRepo: {
    findMaxPriceUSD: vi.fn(),
  },
}));

vi.mock("@/repository/BusinessRepo", () => ({ businessRepo }));
vi.mock("@/repository/MenuItemsRepo", () => ({ menuItemRepo }));

import { businessService } from "@/service/BusinessService";

const BUSINESS_ID = "business-1";

const business = {
  id: BUSINESS_ID,
  name: "Tawilati Demo Cafe",
  slug: "tawilati-demo-cafe",
  exchangeRate: new Prisma.Decimal("89500"),
  timezone: "Asia/Beirut",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const response = {
  id: BUSINESS_ID,
  name: "Tawilati Demo Cafe",
  exchangeRate: new Prisma.Decimal("89500"),
  timezone: "Asia/Beirut",
};

beforeEach(() => {
  vi.clearAllMocks();
  businessRepo.getById.mockResolvedValue(business);
  businessRepo.updateSettings.mockResolvedValue(business);
  menuItemRepo.findMaxPriceUSD.mockResolvedValue(new Prisma.Decimal("10.00"));
});

describe("BusinessService", () => {
  describe("getById", () => {
    it("returns only id, name, exchange rate and timezone", async () => {
      await expect(businessService.getById(BUSINESS_ID)).resolves.toEqual(response);
      expect(businessRepo.getById).toHaveBeenCalledWith(BUSINESS_ID);
    });
  });

  describe("updateSettings", () => {
    it("saves a new rate as a Decimal and returns the mapped business", async () => {
      await expect(
        businessService.updateSettings(BUSINESS_ID, { exchangeRate: 90000 }),
      ).resolves.toEqual(response);

      const [businessId, data] = businessRepo.updateSettings.mock.calls[0];
      expect(businessId).toBe(BUSINESS_ID);
      expect(data.exchangeRate).toBeInstanceOf(Prisma.Decimal);
      expect(data.exchangeRate.toString()).toBe("90000");
      expect(data).not.toHaveProperty("timezone");
    });

    it("keeps up to 4 decimal places of the rate", async () => {
      await businessService.updateSettings(BUSINESS_ID, { exchangeRate: 89500.1234 });

      expect(businessRepo.updateSettings.mock.calls[0][1].exchangeRate.toString()).toBe("89500.1234");
    });

    it("saves the timezone alone without touching the rate or the menu", async () => {
      await businessService.updateSettings(BUSINESS_ID, { timezone: "UTC" });

      expect(businessRepo.updateSettings).toHaveBeenCalledWith(BUSINESS_ID, { timezone: "UTC" });
      expect(menuItemRepo.findMaxPriceUSD).not.toHaveBeenCalled();
    });

    it.each([
      ["zero", 0],
      ["a negative rate", -1],
      ["1,000,000 or more", 1_000_000],
      ["more than 4 decimal places", 89500.12345],
    ])("rejects %s with invalid_exchange_rate", async (_scenario, exchangeRate) => {
      const error = await businessService
        .updateSettings(BUSINESS_ID, { exchangeRate })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error).toMatchObject({ status: 400, message: "invalid_exchange_rate" });
      expect(businessRepo.updateSettings).not.toHaveBeenCalled();
    });

    it("rejects a rate that would push the most expensive item past Decimal(12,2)", async () => {
      // 99999 USD x 200000 = 19,999,800,000 LBP, above 9,999,999,999.99.
      menuItemRepo.findMaxPriceUSD.mockResolvedValue(new Prisma.Decimal("99999.00"));

      await expect(
        businessService.updateSettings(BUSINESS_ID, { exchangeRate: 200000 }),
      ).rejects.toMatchObject({ status: 400, message: "invalid_exchange_rate" });
      expect(businessRepo.updateSettings).not.toHaveBeenCalled();
    });

    it("accepts a new rate when the business has no menu items", async () => {
      menuItemRepo.findMaxPriceUSD.mockResolvedValue(null);

      await businessService.updateSettings(BUSINESS_ID, { exchangeRate: 90000 });

      expect(businessRepo.updateSettings).toHaveBeenCalled();
    });

    it("rejects a timezone outside the allowlist with invalid_timezone", async () => {
      await expect(
        businessService.updateSettings(BUSINESS_ID, { timezone: "Mars/Olympus" }),
      ).rejects.toMatchObject({ status: 400, message: "invalid_timezone" });
      expect(businessRepo.updateSettings).not.toHaveBeenCalled();
    });
  });
});
