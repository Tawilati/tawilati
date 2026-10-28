
import { prisma } from "@/lib/db";

export type CategoryRecord = {
  id: string;
  name: string;
  createdAt: Date;
  itemCount: number;
};

export interface CategoryRepository {
  findManyByBusiness(businessId: string): Promise<CategoryRecord[]>;
  findById(categoryId: string, businessId: string): Promise<CategoryRecord | null>;
   //Look for a category name within one business.
  findByBusinessAndName(
    businessId: string,
    name: string,
  ): Promise<{ id: string } | null>;
  create(businessId: string, name: string): Promise<CategoryRecord>;
  update(categoryId: string, businessId: string, name: string): Promise<CategoryRecord | null>;
  delete(categoryId: string, businessId: string): Promise<boolean>;
}

export class CategoryRepo implements CategoryRepository {
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
    const categories = await prisma.menuCategory.findMany({
      where: { businessId },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: { items: true },
        },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      createdAt: category.createdAt,
      itemCount: category._count.items,
    }));
  }


  async findById(
    categoryId: string,
    businessId: string,
  ): Promise<CategoryRecord | null> {
    const category = await prisma.menuCategory.findFirst({
      where: {
        id: categoryId,
        businessId,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: { items: true },
        },
      },
    });

    if (!category) return null;

    return {
      id: category.id,
      name: category.name,
      createdAt: category.createdAt,
      itemCount: category._count.items,
    };
  }
  //Return the existing category ID, or null if no match exists.
  async findByBusinessAndName(
    businessId: string,
    name: string,
  ): Promise<{ id: string } | null> {
    return prisma.menuCategory.findFirst({
      where: {
        businessId,
        name,
      },
      select: {
        id: true,
      },
    });
  }


  async create(
    businessId: string,
    name: string,
  ): Promise<CategoryRecord> {
    const category = await prisma.menuCategory.create({
      data: {
        businessId,
        name,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: { items: true },
        },
      },
    });

    return {
      id: category.id,
      name: category.name,
      createdAt: category.createdAt,
      itemCount: category._count.items,
    };
  }

  async update(
    categoryId: string,
    businessId: string,
    name: string,
  ): Promise<CategoryRecord | null> {
    const categories = await prisma.menuCategory.updateManyAndReturn({
      where: {
        id: categoryId,
        businessId,
      },
      data: { name },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    const category = categories[0];

    if (!category) return null;

    const updatedCategory = await prisma.menuCategory.findFirst({
      where: {
        id: categoryId,
        businessId,
      },
      select: {
        _count: {
          select: { items: true },
        },
      },
    });

    if (!updatedCategory) return null;

    return {
      id: category.id,
      name: category.name,
      createdAt: category.createdAt,
      itemCount: updatedCategory._count.items,
    };
  }

  
  async delete(
    categoryId: string,
    businessId: string,
  ): Promise<boolean> {
    const result = await prisma.menuCategory.deleteMany({
      where: {
        id: categoryId,
        businessId,
      },
    });

    return result.count > 0;
  }
}

//Exports the shared singleton instead of requiring callers to instantiate the repository.
export const categoryRepo = CategoryRepo.getInstance();
