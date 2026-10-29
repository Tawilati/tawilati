
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { CategoryRecord } from "@/types/Category";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { DBException } from "@/utils/exceptions/RepoException";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/validation/categorySchemas";

// The columns every category query returns, with the item count used by the delete rule and the UI.
const categorySelect = {
  id: true,
  name: true,
  createdAt: true,
  _count: {
    select: { items: true },
  },
} as const;

export class CategoryRepo {
  // Holds the single CategoryRepo instance for the application.
  private static instance: CategoryRepo;

  //Prevents other files from creating instances using `new CategoryRepo()`.
  private constructor() {}

  //Returns the existing instance, creating it only on the first call.
  static getInstance(): CategoryRepo {
    if (!CategoryRepo.instance) {
      CategoryRepo.instance = new CategoryRepo();
    }

    return CategoryRepo.instance;
  }

  async findManyByBusiness(businessId: string): Promise<CategoryRecord[]> {
    try {
      return await prisma.menuCategory.findMany({
        where: { businessId },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }],
        select: categorySelect,
      });
    } catch (err) {
      throw new DBException("Error listing categories", err as Error);
    }
  }

  async findById(
    categoryId: string,
    businessId: string,
  ): Promise<CategoryRecord | null> {
    try {
      return await prisma.menuCategory.findFirst({
        where: {
          id: categoryId,
          businessId,
        },
        select: categorySelect,
      });
    } catch (err) {
      throw new DBException("Error loading category", err as Error);
    }
  }

  //Return the existing category ID, or null if no match exists.
  async findByBusinessAndName(
    businessId: string,
    name: string,
  ): Promise<{ id: string } | null> {
    try {
      return await prisma.menuCategory.findFirst({
        where: {
          businessId,
          name,
        },
        select: {
          id: true,
        },
      });
    } catch (err) {
      throw new DBException("Error checking category name", err as Error);
    }
  }

  async create(
    businessId: string,
    input: CreateCategoryInput,
  ): Promise<CategoryRecord> {
    try {
      return await prisma.menuCategory.create({
        data: {
          businessId,
          name: input.name,
        },
        select: categorySelect,
      });
    } catch (err) {
      // Same name added by two requests at once: handleRouteError answers 409 category_already_exists.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw err;
      throw new DBException("Error creating category", err as Error);
    }
  }

  async update(
    categoryId: string,
    businessId: string,
    input: UpdateCategoryInput,
  ): Promise<CategoryRecord | null> {
    let updated: { id: string }[];
    try {
      updated = await prisma.menuCategory.updateManyAndReturn({
        where: {
          id: categoryId,
          businessId,
        },
        data: { name: input.name },
        select: { id: true },
      });
    } catch (err) {
      // Renamed onto a name taken in a race: handleRouteError answers 409 category_already_exists.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw err;
      throw new DBException("Error updating category", err as Error);
    }

    if (!updated[0]) return null;

    // updateManyAndReturn cannot select relation counts, so read the row back with its count.
    return this.findById(categoryId, businessId);
  }

  async delete(
    categoryId: string,
    businessId: string,
  ): Promise<boolean> {
    try {
      const result = await prisma.menuCategory.deleteMany({
        where: {
          id: categoryId,
          businessId,
        },
      });

      return result.count > 0;
    } catch (err) {
      // P2003: an item was added after the service's empty-category check; the RESTRICT FK refused the delete.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new ConflictException("category_has_items");
      }
      throw new DBException("Error deleting category", err as Error);
    }
  }
}

//Exports the shared singleton instead of requiring callers to instantiate the repository.
export const categoryRepo = CategoryRepo.getInstance();
