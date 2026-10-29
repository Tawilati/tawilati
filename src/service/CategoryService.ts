
//Import the shared repository singleton.
import { categoryRepo } from "@/repository/CategoryRepo";
import {
  mapToCategoryResponse,
  mapToCategoryResponseList,
  type CategoryResponse,
} from "@/types/Category";

import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

export class CategoryService {
  //Stores the single CategoryService instance.
  private static instance: CategoryService;

  //Private constructor prevents external code from creating additional service instances.
  private constructor() {}

  //Returns the existing instance or creates it once.
  static getInstance(): CategoryService {
    if (!CategoryService.instance) {
      CategoryService.instance = new CategoryService();
    }

    return CategoryService.instance;
  }

  async listCategories(businessId: string): Promise<CategoryResponse[]> {
    const categories = await categoryRepo.findManyByBusiness(businessId);
    return mapToCategoryResponseList(categories);
  }

  async getCategory(
    categoryId: string,
    businessId: string,
  ): Promise<CategoryResponse> {
    const category = await categoryRepo.findById(categoryId, businessId);

    if (!category) {
      throw new NotFoundException("category_not_found");
    }

    return mapToCategoryResponse(category);
  }

  async createCategory(
    businessId: string,
    name: string,
  ): Promise<CategoryResponse> {
    //Check for a duplicate within this business.
    const existingCategory = await categoryRepo.findByBusinessAndName(businessId, name);
    //Reject duplicate names with HTTP 409 Conflict.
    if (existingCategory) {
      throw new ConflictException("category_already_exists");
    }

    const category = await categoryRepo.create(businessId, { name });
    return mapToCategoryResponse(category);
  }

  async updateCategory(
    categoryId: string,
    businessId: string,
    name: string,
  ): Promise<CategoryResponse> {
    //Renaming onto another category's name is the same 409 as creating a duplicate.
    const existingCategory = await categoryRepo.findByBusinessAndName(businessId, name);
    if (existingCategory && existingCategory.id !== categoryId) {
      throw new ConflictException("category_already_exists");
    }

    const category = await categoryRepo.update(categoryId, businessId, { name });

    if (!category) {
      throw new NotFoundException("category_not_found");
    }

    return mapToCategoryResponse(category);
  }

  async deleteCategory(
    categoryId: string,
    businessId: string,
  ): Promise<void> {
    const category = await categoryRepo.findById(categoryId, businessId);

    if (!category) {
      throw new NotFoundException("category_not_found");
    }

    if (category._count.items > 0) {
      throw new ConflictException("category_has_items");
    }

    const deleted = await categoryRepo.delete(categoryId, businessId);

    if (!deleted) {
      throw new NotFoundException("category_not_found");
    }
  }
}

//Export one shared service instance for route handlers to import.
export const categoryService = CategoryService.getInstance();
