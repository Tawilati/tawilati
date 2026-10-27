import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import type {
  MenuItemRepository,
  MenuItemRecord,
} from "@/repository/MenuItemsRepo";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

vi.mock("@/repository/MenuItemsRepo", () => ({
  menuItemRepo: {},
}));

import { MenuItemService } from "@/service/MenuItemsService";
const { repo } = vi.hoisted(() => ({
  repo: {
    findManyByBusiness: vi.fn(),
    findById: vi.fn(),
    findBusinessExchangeRate: vi.fn(),
    categoryBelongsToBusiness: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setArchived: vi.fn(),
  },
}));

const categoryRepository = repo as unknown as MenuItemRepository;
const menuItemService = new MenuItemService(categoryRepository);

const BUSINESS_ID = "business-1";
const ITEM_ID = "item-1";
const CATEGORY_ID = "123e4567-e89b-12d3-a456-426614174000";

const item: MenuItemRecord = {
  id: ITEM_ID,
  businessId: BUSINESS_ID,
  categoryId: CATEGORY_ID,
  name: "Latte",
  priceUSD: new Prisma.Decimal("3.50"),
  priceLBP: new Prisma.Decimal("315000.00"),
  soldOut: false,
  archivedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const exchangeRate = new Prisma.Decimal("90000");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MenuItemService", () => {
  describe("getAll", () => {
    it("returns menu items for a business", async () => {
      repo.findManyByBusiness.mockResolvedValue([item]);

      await expect(menuItemService.getAll(BUSINESS_ID)).resolves.toEqual([
        item,
      ]);

      expect(repo.findManyByBusiness).toHaveBeenCalledWith(BUSINESS_ID);
    });
  });

  describe("getById", () => {
    it("returns the menu item when found", async () => {
      repo.findById.mockResolvedValue(item);

      await expect(
        menuItemService.getById(BUSINESS_ID, ITEM_ID),
      ).resolves.toEqual(item);

      expect(repo.findById).toHaveBeenCalledWith(ITEM_ID, BUSINESS_ID);
    });

    it("throws NotFoundException when the item does not exist", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        menuItemService.getById(BUSINESS_ID, ITEM_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("creates an item and calculates its LBP price", async () => {
      repo.categoryBelongsToBusiness.mockResolvedValue(true);
      repo.findBusinessExchangeRate.mockResolvedValue(exchangeRate);
      repo.create.mockImplementation(async (_businessId, data) => ({
        ...item,
        ...data,
      }));

      await menuItemService.create(BUSINESS_ID, {
        name: "Latte",
        categoryId: CATEGORY_ID,
        priceUSD: 3.5,
      });

      expect(repo.categoryBelongsToBusiness).toHaveBeenCalledWith(
        CATEGORY_ID,
        BUSINESS_ID,
      );
      expect(repo.findBusinessExchangeRate).toHaveBeenCalledWith(BUSINESS_ID);
      expect(repo.create).toHaveBeenCalledWith(BUSINESS_ID, {
        name: "Latte",
        categoryId: CATEGORY_ID,
        priceUSD: new Prisma.Decimal("3.50"),
        priceLBP: new Prisma.Decimal("315000.00"),
        soldOut: false,
      });
    });

    it("trims the USD price to two decimal places using half-up rounding", async () => {
      repo.categoryBelongsToBusiness.mockResolvedValue(true);
      repo.findBusinessExchangeRate.mockResolvedValue(exchangeRate);
      repo.create.mockResolvedValue(item);

      await menuItemService.create(BUSINESS_ID, {
        name: "Latte",
        categoryId: CATEGORY_ID,
        priceUSD: 3.456,
      });

      expect(repo.create).toHaveBeenCalledWith(
        BUSINESS_ID,
        expect.objectContaining({
          priceUSD: new Prisma.Decimal("3.46"),
          priceLBP: new Prisma.Decimal("311400.00"),
        }),
      );
    });

    it("uses the supplied soldOut value", async () => {
      repo.categoryBelongsToBusiness.mockResolvedValue(true);
      repo.findBusinessExchangeRate.mockResolvedValue(exchangeRate);
      repo.create.mockResolvedValue({ ...item, soldOut: true });

      await menuItemService.create(BUSINESS_ID, {
        name: "Latte",
        categoryId: CATEGORY_ID,
        priceUSD: 3.5,
        soldOut: true,
      });

      expect(repo.create).toHaveBeenCalledWith(
        BUSINESS_ID,
        expect.objectContaining({ soldOut: true }),
      );
    });

    it("throws BadRequestException if the category belongs to another business", async () => {
      repo.categoryBelongsToBusiness.mockResolvedValue(false);

      await expect(
        menuItemService.create(BUSINESS_ID, {
          name: "Latte",
          categoryId: CATEGORY_ID,
          priceUSD: 3.5,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repo.create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException if the business does not exist", async () => {
      repo.categoryBelongsToBusiness.mockResolvedValue(true);
      repo.findBusinessExchangeRate.mockResolvedValue(null);

      await expect(
        menuItemService.create(BUSINESS_ID, {
          name: "Latte",
          categoryId: CATEGORY_ID,
          priceUSD: 3.5,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("updates the item name", async () => {
      repo.findById.mockResolvedValue(item);
      repo.update.mockResolvedValue({ ...item, name: "Iced Latte" });

      await menuItemService.update(BUSINESS_ID, ITEM_ID, {
        name: "Iced Latte",
      });

      expect(repo.update).toHaveBeenCalledWith(ITEM_ID, BUSINESS_ID, {
        name: "Iced Latte",
      });
    });

    it("updates the category when it belongs to the business", async () => {
      const newCategoryId = "123e4567-e89b-12d3-a456-426614174001";
      repo.findById.mockResolvedValue(item);
      repo.categoryBelongsToBusiness.mockResolvedValue(true);
      repo.update.mockResolvedValue({ ...item, categoryId: newCategoryId });

      await menuItemService.update(BUSINESS_ID, ITEM_ID, {
        categoryId: newCategoryId,
      });

      expect(repo.categoryBelongsToBusiness).toHaveBeenCalledWith(
        newCategoryId,
        BUSINESS_ID,
      );
      expect(repo.update).toHaveBeenCalledWith(ITEM_ID, BUSINESS_ID, {
        categoryId: newCategoryId,
      });
    });

    it("throws BadRequestException if the new category belongs to another business", async () => {
      const newCategoryId = "123e4567-e89b-12d3-a456-426614174001";
      repo.findById.mockResolvedValue(item);
      repo.categoryBelongsToBusiness.mockResolvedValue(false);

      await expect(
        menuItemService.update(BUSINESS_ID, ITEM_ID, {
          categoryId: newCategoryId,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it("updates soldOut without changing the price", async () => {
      repo.findById.mockResolvedValue(item);
      repo.update.mockResolvedValue({ ...item, soldOut: true });

      await menuItemService.update(BUSINESS_ID, ITEM_ID, {
        soldOut: true,
      });

      expect(repo.update).toHaveBeenCalledWith(ITEM_ID, BUSINESS_ID, {
        soldOut: true,
      });
      expect(repo.findBusinessExchangeRate).not.toHaveBeenCalled();
    });

    it("recalculates the LBP price when the USD price changes", async () => {
      repo.findById.mockResolvedValue(item);
      repo.findBusinessExchangeRate.mockResolvedValue(exchangeRate);
      repo.update.mockResolvedValue({
        ...item,
        priceUSD: new Prisma.Decimal("4.00"),
        priceLBP: new Prisma.Decimal("360000.00"),
      });

      await menuItemService.update(BUSINESS_ID, ITEM_ID, {
        priceUSD: 4,
      });

      expect(repo.update).toHaveBeenCalledWith(ITEM_ID, BUSINESS_ID, {
        priceUSD: new Prisma.Decimal("4.00"),
        priceLBP: new Prisma.Decimal("360000.00"),
      });
    });

    it("throws NotFoundException when the item does not exist", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        menuItemService.update(BUSINESS_ID, ITEM_ID, { name: "Iced Latte" }),
      ).rejects.toThrow(NotFoundException);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException if the business is missing when changing the price", async () => {
      repo.findById.mockResolvedValue(item);
      repo.findBusinessExchangeRate.mockResolvedValue(null);

      await expect(
        menuItemService.update(BUSINESS_ID, ITEM_ID, { priceUSD: 4 }),
      ).rejects.toThrow(NotFoundException);

      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe("archive", () => {
    it("archives an active menu item", async () => {
      repo.findById.mockResolvedValue(item);
      repo.setArchived.mockImplementation(async (_itemId, _businessId, archivedAt) => ({
        ...item,
        archivedAt,
      }));

      const result = await menuItemService.archive(BUSINESS_ID, ITEM_ID);

      expect(repo.setArchived).toHaveBeenCalledWith(
        ITEM_ID,
        BUSINESS_ID,
        expect.any(Date),
      );
      expect(result?.archivedAt).toBeInstanceOf(Date);
    });

    it("throws NotFoundException when the item does not exist", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        menuItemService.archive(BUSINESS_ID, ITEM_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.setArchived).not.toHaveBeenCalled();
    });

    it("throws ConflictException when the item is already archived", async () => {
      repo.findById.mockResolvedValue({
        ...item,
        archivedAt: new Date("2026-01-02T00:00:00.000Z"),
      });

      await expect(
        menuItemService.archive(BUSINESS_ID, ITEM_ID),
      ).rejects.toThrow(ConflictException);

      expect(repo.setArchived).not.toHaveBeenCalled();
    });
  });

  describe("unarchive", () => {
    it("restores an archived menu item", async () => {
      repo.findById.mockResolvedValue({
        ...item,
        archivedAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      repo.setArchived.mockResolvedValue(item);

      await expect(
        menuItemService.unarchive(BUSINESS_ID, ITEM_ID),
      ).resolves.toEqual(item);

      expect(repo.setArchived).toHaveBeenCalledWith(
        ITEM_ID,
        BUSINESS_ID,
        null,
      );
    });

    it("throws NotFoundException when the item does not exist", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        menuItemService.unarchive(BUSINESS_ID, ITEM_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.setArchived).not.toHaveBeenCalled();
    });

    it("throws ConflictException when the item is not archived", async () => {
      repo.findById.mockResolvedValue(item);

      await expect(
        menuItemService.unarchive(BUSINESS_ID, ITEM_ID),
      ).rejects.toThrow(ConflictException);

      expect(repo.setArchived).not.toHaveBeenCalled();
    });
  });
});