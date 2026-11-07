// The kitchen's Sold out screen: which items to list for the chosen category and search, and how many are off
// the menu. Archived items never show: guests can't order them anyway, and only the owner can bring them back.

export type BoardItem = {
  id: string;
  categoryId: string;
  name: string;
  priceUSD: string;
  priceLBP: string;
  soldOut: boolean;
  archivedAt: string | null;
};

export function soldOutView<T extends BoardItem>(items: T[], categoryId: string, search: string) {
  const live = items.filter((item) => item.archivedAt === null);
  const query = search.trim().toLowerCase();
  return {
    items: live.filter(
      (item) =>
        (categoryId === "all" || item.categoryId === categoryId) &&
        (query === "" || item.name.toLowerCase().includes(query)),
    ),
    soldOutCount: live.filter((item) => item.soldOut).length,
  };
}

// The list with one item switched, as the screen shows it while the server confirms.
export function applySoldOut<T extends BoardItem>(items: T[], itemId: string, soldOut: boolean): T[] {
  return items.map((item) => (item.id === itemId ? { ...item, soldOut } : item));
}
