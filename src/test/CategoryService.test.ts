import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CategoryRepository,
  CategoryRecord,
} from "@/repository/CategoryRepo";
import { CategoryService } from "@/service/CategoryService";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

const { repo } = vi.hoisted(() => ({
  repo: {
    findManyByBusiness: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const categoryRepository = repo as unknown as CategoryRepository;
const categoryService = new CategoryService(categoryRepository);

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

      await expect(categoryService.listCategories("business-1")).resolves.toEqual([
        category,
      ]);

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
      repo.create.mockResolvedValue(category);

      await expect(
        categoryService.createCategory("business-1", "Drinks"),
      ).resolves.toEqual(category);

      expect(repo.create).toHaveBeenCalledWith("business-1", "Drinks");
    });
  });

  describe("updateCategory", () => {
    it("updates and returns the category", async () => {
      const updatedCategory = { ...category, name: "Desserts" };
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
      repo.update.mockResolvedValue(null);

      await expect(
        categoryService.updateCategory(
          "missing-category",
          "business-1",
          "Desserts",
        ),
      ).rejects.toThrow(NotFoundException);
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
      repo.findById.mockResolvedValue({ ...category, itemCount: 2 });

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