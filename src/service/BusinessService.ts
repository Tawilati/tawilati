import { Prisma } from "@/app/generated/prisma/client";
import { businessRepo } from "@/repository/BusinessRepo";
import { menuItemRepo } from "@/repository/MenuItemsRepo";
import { MAX_PRICE_LBP } from "@/service/MenuItemsService";
import {
  mapToBusinessResponse,
  type BusinessResponse,
  type UpdateBusinessData,
} from "@/types/Business";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { TIMEZONES, type UpdateBusinessInput } from "@/validation/businessSchemas";

// exchangeRate is Decimal(10,4): below 10^6, at most 4 decimal places.
const MAX_EXCHANGE_RATE = new Prisma.Decimal("1000000");

export class BusinessService {
  //Stores the single BusinessService instance.
  private static instance: BusinessService;

  //Prevents other files from creating instances with `new`.
  private constructor() {}

  //Returns the existing instance or creates it once.
  static getInstance(): BusinessService {
    if (!BusinessService.instance) {
      BusinessService.instance = new BusinessService();
    }

    return BusinessService.instance;
  }

  // The business of the signed-in staff member; the id comes from the session, never the request body.
  async getById(businessId: string): Promise<BusinessResponse> {
    const business = await businessRepo.getById(businessId);
    return mapToBusinessResponse(business);
  }

  // OWNER changes the exchange rate and/or the timezone.
  // A new rate reprices every menu item's priceLBP; order lines keep the prices they were sold at.
  async updateSettings(businessId: string, input: UpdateBusinessInput): Promise<BusinessResponse> {
    const data: UpdateBusinessData = {};

    if (input.timezone !== undefined) {
      if (!(TIMEZONES as readonly string[]).includes(input.timezone)) {
        throw new BadRequestException("invalid_timezone", {
          timezone: [`Must be one of ${TIMEZONES.join(", ")}`],
        });
      }
      data.timezone = input.timezone;
    }

    if (input.exchangeRate !== undefined) {
      const exchangeRate = new Prisma.Decimal(input.exchangeRate);

      if (exchangeRate.lte(0) || exchangeRate.gte(MAX_EXCHANGE_RATE) || exchangeRate.decimalPlaces() > 4) {
        throw new BadRequestException("invalid_exchange_rate", {
          exchangeRate: ["Must be above 0 and below 1,000,000, with at most 4 decimal places"],
        });
      }

      // priceLBP is Decimal(12,2); the most expensive item must still fit after repricing.
      const maxPriceUSD = await menuItemRepo.findMaxPriceUSD(businessId);
      if (
        maxPriceUSD &&
        maxPriceUSD.mul(exchangeRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).gte(MAX_PRICE_LBP)
      ) {
        throw new BadRequestException("invalid_exchange_rate", {
          exchangeRate: ["Too high for the current menu prices"],
        });
      }

      data.exchangeRate = exchangeRate;
    }

    const business = await businessRepo.updateSettings(businessId, data);
    return mapToBusinessResponse(business);
  }
}

//Export one shared service instance for route handlers to import.
export const businessService = BusinessService.getInstance();
