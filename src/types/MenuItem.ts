import type { Prisma } from "@/app/generated/prisma/client";

// What the menu item repository returns.
export type MenuItemRecord = {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  priceUSD: Prisma.Decimal;
  priceLBP: Prisma.Decimal;
  soldOut: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// What the service hands the repository on create: prices already rounded and converted.
export type CreateMenuItemData = {
  categoryId: string;
  name: string;
  priceUSD: Prisma.Decimal;
  priceLBP: Prisma.Decimal;
  soldOut?: boolean;
};

// Only the fields being changed; priceLBP is set whenever priceUSD is.
export type UpdateMenuItemData = {
  categoryId?: string;
  name?: string;
  priceUSD?: Prisma.Decimal;
  priceLBP?: Prisma.Decimal;
  soldOut?: boolean;
};

// "in_use": an order line points at the item, so only archiving is possible.
export type DeleteMenuItemResult = "deleted" | "not_found" | "in_use";
