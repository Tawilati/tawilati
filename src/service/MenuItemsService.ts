import { Prisma } from "@/app/generated/prisma/client";

import {
  menuItemRepo,
  type MenuItemRepository,
} from "@/repository/MenuItemsRepo";

import type {
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from "@/validation/menuItemsSchemas";

import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";

export class MenuItemService {
  // Stores the single MenuItemService instance.
  private static instance: MenuItemService;

  //Prevents external code from creating service instances.
  //The repository is injected into the service.
  private constructor(private readonly repo: MenuItemRepository) {}

  // Returns the existing instance or creates it once.
  static getInstance(): MenuItemService {
    if (!MenuItemService.instance) {
      // CHANGED 2: Explicitly inject the shared repository singleton.
      MenuItemService.instance = new MenuItemService(menuItemRepo);
    }

    return MenuItemService.instance;
  }

  private calculatePriceLBP(
    priceUSD: Prisma.Decimal,
    exchangeRate: Prisma.Decimal,
  ): Prisma.Decimal {
    return priceUSD
      .mul(exchangeRate)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  // List menu items belonging to a business.
  async getAll(businessId: string) {
    return this.repo.findManyByBusiness(businessId);
  }

  // Get a menu item belonging to a business.
  async getById(businessId: string, itemId: string) {
    const item = await this.repo.findById(itemId, businessId);

    if (!item) {
      throw new NotFoundException("menu_item_not_found");
    }

    return item;
  }

  // Create a menu item for a business.
  async create(businessId: string, input: CreateMenuItemInput) {
    const categoryExists = await this.repo.categoryBelongsToBusiness(
      input.categoryId,
      businessId,
    );

    if (!categoryExists) {
      throw new BadRequestException("category_not_in_business");
    }

    const exchangeRate = await this.repo.findBusinessExchangeRate(businessId);

    if (!exchangeRate) {
      throw new NotFoundException("business_not_found");
    }

    const priceUSD = new Prisma.Decimal(input.priceUSD).toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );

    const priceLBP = this.calculatePriceLBP(priceUSD, exchangeRate);

    return this.repo.create(businessId, {
      name: input.name,
      categoryId: input.categoryId,
      priceUSD,
      priceLBP,
      soldOut: input.soldOut ?? false,
    });
  }

  // Update a menu item belonging to a business.
  async update(businessId: string, itemId: string, input: UpdateMenuItemInput) {
    const existingItem = await this.repo.findById(itemId, businessId);

    if (!existingItem) {
      throw new NotFoundException("menu_item_not_found");
    }

    if (input.categoryId !== undefined) {
      const categoryExists = await this.repo.categoryBelongsToBusiness(
        input.categoryId,
        businessId,
      );

      if (!categoryExists) {
        throw new BadRequestException("category_not_in_business");
      }
    }

    const data: {
      name?: string;
      categoryId?: string;
      priceUSD?: Prisma.Decimal;
      priceLBP?: Prisma.Decimal;
      soldOut?: boolean;
    } = {};

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
      const exchangeRate = await this.repo.findBusinessExchangeRate(businessId);

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

    return this.repo.update(itemId, businessId, data);
  }

  // Archive a menu item without deleting its historical data.
  async archive(businessId: string, itemId: string) {
    const item = await this.repo.findById(itemId, businessId);

    if (!item) {
      throw new NotFoundException("menu_item_not_found");
    }

    if (item.archivedAt !== null) {
      throw new ConflictException("menu_item_already_archived");
    }

    return this.repo.setArchived(itemId, businessId, new Date());
  }

  // Restore an archived menu item.
  async unarchive(businessId: string, itemId: string) {
    const item = await this.repo.findById(itemId, businessId);

    if (!item) {
      throw new NotFoundException("menu_item_not_found");
    }

    if (item.archivedAt === null) {
      throw new ConflictException("menu_item_not_archived");
    }

    return this.repo.setArchived(itemId, businessId, null);
  }

  // Delete a menu item that was never ordered. An ordered item can only be archived.
  async delete(businessId: string, itemId: string): Promise<void> {
    const result = await this.repo.delete(itemId, businessId);

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
