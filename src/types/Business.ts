import type { Business } from "@/app/generated/prisma/client";
import { Decimal } from "@prisma/client/runtime/client";

// What /api/business sends back.
export interface BusinessResponse {
  id: string;
  name: string;
  exchangeRate: Decimal // Decimal as a string, e.g. "89500"
  timezone: string;
}

// What businessRepo.updateSettings needs: the rate is already a checked Decimal.
export type UpdateBusinessData = {
  exchangeRate?: Decimal;
  timezone?: string;
};

export function mapToBusinessResponse(business: Business): BusinessResponse {
  return {
    id: business.id,
    name: business.name,
    exchangeRate: business.exchangeRate,
    timezone: business.timezone,
  };
}
