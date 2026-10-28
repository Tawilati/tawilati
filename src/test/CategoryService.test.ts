
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryRecord } from "@/repository/CategoryRepo";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

const { repo } = vi.hoisted(() => ({
  repo: {
    findManyByBusiness: vi.fn(),
    findById: vi.fn(),
    findByBusinessAndName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/repository/CategoryRepo", () => ({
  categoryRepo: repo,
}));

import { categoryService } from "@/service/CategoryService";

const category: CategoryRecord = {
  id: "category-1",
  name: "Drinks",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  itemCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CategoryService", () => {
  describe("listCategories", () => {
    it("returns categories for a business", async () => {
      repo.findManyByBusiness.mockResolvedValue([category]);

      await expect(
        categoryService.listCategories("business-1"),
      ).resolves.toEqual([category]);

      expect(repo.findManyByBusiness).toHaveBeenCalledWith("business-1");
    });
  });

  describe("getCategory", () => {
    it("returns the category when found", async () => {
      repo.findById.mockResolvedValue(category);

      await expect(
        categoryService.getCategory("category-1", "business-1"),
      ).resolves.toEqual(category);

      expect(repo.findById).toHaveBeenCalledWith(
        "category-1",
        "business-1",
      );
    });

    it("throws NotFoundException when the category does not exist", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        categoryService.getCategory("missing-category", "business-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createCategory", () => {
    it("creates and returns a category", async () => {
      repo.findByBusinessAndName.mockResolvedValue(null);
      repo.create.mockResolvedValue(category);

      await expect(
        categoryService.createCategory("business-1", "Drinks"),
      ).resolves.toEqual(category);

      expect(repo.findByBusinessAndName).toHaveBeenCalledWith(
        "business-1",
        "Drinks",
      );

      expect(repo.create).toHaveBeenCalledWith("business-1", "Drinks");
    });

    it("throws ConflictException when the category name already exists", async () => {
      repo.findByBusinessAndName.mockResolvedValue(category);

      await expect(
        categoryService.createCategory("business-1", "Drinks"),
      ).rejects.toThrow(ConflictException);

      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("updateCategory", () => {
    it("updates and returns the category", async () => {
      const updatedCategory = { ...category, name: "Desserts" };
      repo.findByBusinessAndName.mockResolvedValue(null);
      repo.update.mockResolvedValue(updatedCategory);

      await expect(
        categoryService.updateCategory(
          "category-1",
          "business-1",
          "Desserts",
        ),
      ).resolves.toEqual(updatedCategory);

      expect(repo.update).toHaveBeenCalledWith(
        "category-1",
        "business-1",
        "Desserts",
      );
    });

    it("throws NotFoundException when the category does not exist", async () => {
      repo.findByBusinessAndName.mockResolvedValue(null);
      repo.update.mockResolvedValue(null);

      await expect(
        categoryService.updateCategory(
          "missing-category",
          "business-1",
          "Desserts",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException when another category already has the name", async () => {
      repo.findByBusinessAndName.mockResolvedValue({ id: "category-2" });

      await expect(
        categoryService.updateCategory("category-1", "business-1", "Desserts"),
      ).rejects.toThrow(ConflictException);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it("allows saving a category under its own name", async () => {
      repo.findByBusinessAndName.mockResolvedValue({ id: "category-1" });
      repo.update.mockResolvedValue(category);

      await expect(
        categoryService.updateCategory("category-1", "business-1", "Drinks"),
      ).resolves.toEqual(category);
    });
  });

  describe("deleteCategory", () => {
    it("deletes a category with no items", async () => {
      repo.findById.mockResolvedValue(category);
      repo.delete.mockResolvedValue(true);

      await expect(
        categoryService.deleteCategory("category-1", "business-1"),
      ).resolves.toBeUndefined();

      expect(repo.delete).toHaveBeenCalledWith(
        "category-1",
        "business-1",
      );
    });

    it("throws NotFoundException when the category does not exist", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        categoryService.deleteCategory("missing-category", "business-1"),
      ).rejects.toThrow(NotFoundException);

      expect(repo.delete).not.toHaveBeenCalled();
    });

    it("throws ConflictException when the category contains items", async () => {
      repo.findById.mockResolvedValue({
        ...category,
        itemCount: 2,
      });

      await expect(
        categoryService.deleteCategory("category-1", "business-1"),
      ).rejects.toThrow(ConflictException);

      expect(repo.delete).not.toHaveBeenCalled();
    });

    it("throws NotFoundException if the category disappears before deletion", async () => {
      repo.findById.mockResolvedValue(category);
      repo.delete.mockResolvedValue(false);

      await expect(
        categoryService.deleteCategory("category-1", "business-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
