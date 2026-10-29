// What the category repository returns: the row plus how many items (archived too) point at it.
export type CategoryRecord = {
  id: string;
  name: string;
  createdAt: Date;
  _count: { items: number };
};

// What /api/categories sends back.
export interface CategoryResponse {
  id: string;
  name: string;
  createdAt: Date;
  itemCount: number;
}

export function mapToCategoryResponse(category: CategoryRecord): CategoryResponse {
  return {
    id: category.id,
    name: category.name,
    createdAt: category.createdAt,
    itemCount: category._count.items,
  };
}

export function mapToCategoryResponseList(categories: CategoryRecord[]): CategoryResponse[] {
  return categories.map(mapToCategoryResponse);
}
