import { Prisma } from "@/app/generated/prisma/client";

import { menuItemRepo } from "@/repository/MenuItemsRepo";
import type { UpdateMenuItemData } from "@/types/MenuItem";

import type {
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from "@/validation/menuItemsSchemas";

import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";

// Decimal(12,2) holds values below 10^10.
export const MAX_PRICE_LBP =new Prisma.Decimal("10000000000");

export class MenuItemService {
  // Stores the single MenuItemService instance.
  private static instance: MenuItemService;

  //Prevents external code from creating service instances.
  private constructor() {}

  // Returns the existing instance or creates it once.
  static getInstance(): MenuItemService {
    if (!MenuItemService.instance) {
      MenuItemService.instance = new MenuItemService();
    }

    return MenuItemService.instance;
  }

  private calculatePriceLBP(
    priceUSD: Prisma.Decimal,
    exchangeRate: Prisma.Decimal,
  ): Prisma.Decimal {
    const priceLBP = priceUSD
      .mul(exchangeRate)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    // priceLBP is Decimal(12,2); a high rate can push a valid USD price past it.
    if (priceLBP.gte(MAX_PRICE_LBP)) {
      throw new BadRequestException("validation_error", {
        priceUSD: ["Price is too high for the current exchange rate"],
      });
    }

    return priceLBP;
  }

  // List menu items belonging to a business.
  async getAll(businessId: string) {
    return menuItemRepo.findManyByBusiness(businessId);
  }

  // Get a menu item belonging to a business.
  async getById(businessId: string, itemId: string) {
    const item = await menuItemRepo.findById(itemId, businessId);

    if (!item) {
      throw new NotFoundException("menu_item_not_found");
    }

    return item;
  }

  // Create a menu item for a business.
  async create(businessId: string, input: CreateMenuItemInput) {
    const categoryExists = await menuItemRepo.categoryBelongsToBusiness(
      input.categoryId,
      businessId,
    );

    if (!categoryExists) {
      throw new BadRequestException("category_not_in_business");
    }

    const exchangeRate = await menuItemRepo.findBusinessExchangeRate(businessId);

    if (!exchangeRate) {
      throw new NotFoundException("business_not_found");
    }

    const priceUSD = new Prisma.Decimal(input.priceUSD).toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );

    const priceLBP = this.calculatePriceLBP(priceUSD, exchangeRate);

    return menuItemRepo.create(businessId, {
      name: input.name,
      categoryId: input.categoryId,
      priceUSD,
      priceLBP,
      soldOut: input.soldOut ?? false,
    });
  }

  // Update a menu item belonging to a business.
  async update(businessId: string, itemId: string, input: UpdateMenuItemInput) {
    const existingItem = await menuItemRepo.findById(itemId, businessId);

    if (!existingItem) {
      throw new NotFoundException("menu_item_not_found");
    }

    if (input.categoryId !== undefined) {
      const categoryExists = await menuItemRepo.categoryBelongsToBusiness(
        input.categoryId,
        businessId,
      );

      if (!categoryExists) {
        throw new BadRequestException("category_not_in_business");
      }
    }

    const data: UpdateMenuItemData = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }

    if (input.categoryId !== undefined) {
      data.categoryId = input.categoryId;
    }

    if (input.soldOut !== undefined) {
      data.soldOut = input.soldOut;
    }

    if (input.priceUSD !== undefined) {
      const exchangeRate = await menuItemRepo.findBusinessExchangeRate(businessId);

      if (!exchangeRate) {
        throw new NotFoundException("business_not_found");
      }

      const priceUSD = new Prisma.Decimal(input.priceUSD).toDecimalPlaces(
        2,
        Prisma.Decimal.ROUND_HALF_UP,
      );

      data.priceUSD = priceUSD;
      data.priceLBP = this.calculatePriceLBP(priceUSD, exchangeRate);
    }

    return menuItemRepo.update(itemId, businessId, data);
  }

  // Archive a menu item without deleting its historical data.
  async archive(businessId: string, itemId: string) {
    const item = await menuItemRepo.findById(itemId, businessId);

    if (!item) {
      throw new NotFoundException("menu_item_not_found");
    }

    if (item.archivedAt !== null) {
      throw new ConflictException("menu_item_already_archived");
    }

    return menuItemRepo.setArchived(itemId, businessId, new Date());
  }

  // Restore an archived menu item.
  async unarchive(businessId: string, itemId: string) {
    const item = await menuItemRepo.findById(itemId, businessId);

    if (!item) {
      throw new NotFoundException("menu_item_not_found");
    }

    if (item.archivedAt === null) {
      throw new ConflictException("menu_item_not_archived");
    }

    return menuItemRepo.setArchived(itemId, businessId, null);
  }

  // Delete a menu item that was never ordered. An ordered item can only be archived.
  async delete(businessId: string, itemId: string): Promise<void> {
    const result = await menuItemRepo.delete(itemId, businessId);

    if (result === "not_found") {
      throw new NotFoundException("menu_item_not_found");
    }

    if (result === "in_use") {
      throw new ConflictException("menu_item_in_use");
    }
  }
}

//Export the shared service instance for route handlers.
export const menuItemService = MenuItemService.getInstance();
