
import type {
  CategoryRepository,
  CategoryRecord,
} from "@/repository/CategoryRepo";

//Import the shared repository singleton.
import { categoryRepo } from "@/repository/CategoryRepo";

import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

export class CategoryService {
  //Stores the single CategoryService instance.
  private static instance: CategoryService;

  //Private constructor prevents external code from creating additional service instances. The shared repository is injected here.
  private constructor(private readonly repo: CategoryRepository) {}

  //Returns the existing instance or creates it once.
  static getInstance(): CategoryService {
    if (!CategoryService.instance) {
      CategoryService.instance = new CategoryService(categoryRepo);
    }

    return CategoryService.instance;
  }

  async listCategories(businessId: string): Promise<CategoryRecord[]> {
    return this.repo.findManyByBusiness(businessId);
  }

  async getCategory(
    categoryId: string,
    businessId: string,
  ): Promise<CategoryRecord> {
    const category = await this.repo.findById(categoryId, businessId);

    if (!category) {
      throw new NotFoundException("category_not_found");
    }

    return category;
  }

  async createCategory(
    businessId: string,
    name: string,
  ): Promise<CategoryRecord> {
    //Check for a duplicate within this business.
    const existingCategory = await this.repo.findByBusinessAndName(
      businessId,
      name,);
      //Reject duplicate names with HTTP 409 Conflict.
    if (existingCategory) {
      throw new ConflictException("category_already_exists");
    }
return this.repo.create(businessId, name);
  }

  async updateCategory(
    categoryId: string,
    businessId: string,
    name: string,
  ): Promise<CategoryRecord> {
    //Renaming onto another category's name is the same 409 as creating a duplicate.
    const existingCategory = await this.repo.findByBusinessAndName(businessId, name);
    if (existingCategory && existingCategory.id !== categoryId) {
      throw new ConflictException("category_already_exists");
    }

    const category = await this.repo.update(
      categoryId,
      businessId,
      name,
    );

    if (!category) {
      throw new NotFoundException("category_not_found");
    }

    return category;
  }

  async deleteCategory(
    categoryId: string,
    businessId: string,
  ): Promise<void> {
    const category = await this.repo.findById(categoryId, businessId);

    if (!category) {
      throw new NotFoundException("category_not_found");
    }

    if (category.itemCount > 0) {
      throw new ConflictException("category_has_items");
    }

    const deleted = await this.repo.delete(categoryId, businessId);

    if (!deleted) {
      throw new NotFoundException("category_not_found");
    }
  }
}

//Export one shared service instance for route handlers to import.
export const categoryService = CategoryService.getInstance();
