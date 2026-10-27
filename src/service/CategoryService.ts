
import type {
  CategoryRepository,
  CategoryRecord,
} from "@/repository/CategoryRepo";

import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

export class CategoryService {
  constructor(private readonly repo: CategoryRepository) {}

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
    return this.repo.create(businessId, name);
  }

  async updateCategory(
    categoryId: string,
    businessId: string,
    name: string,
  ): Promise<CategoryRecord> {
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
