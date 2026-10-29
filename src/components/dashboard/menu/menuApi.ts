// The owner's menu screen talks to /api/categories and /api/menu-items. Decimals arrive as strings ("2.50").
// Error codes never reach the person: `sentenceFor` turns each one into a sentence.

import { ApiError, call } from "../api";

export { ApiError };

export type Category = { id: string; name: string; itemCount: number };

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  priceUSD: string;
  priceLBP: string;
  soldOut: boolean;
  archivedAt: string | null;
};

export type ItemInput = { name: string; categoryId: string; priceUSD: number };

export const menuApi = {
  categories: () => call<Category[]>("/api/categories", "GET"),
  addCategory: (name: string) => call<Category>("/api/categories", "POST", { name }),
  renameCategory: (id: string, name: string) => call<Category>(`/api/categories/${id}`, "PATCH", { name }),
  deleteCategory: (id: string) => call(`/api/categories/${id}`, "DELETE"),

  items: () => call<MenuItem[]>("/api/menu-items", "GET"),
  addItem: (input: ItemInput) => call<MenuItem>("/api/menu-items", "POST", input),
  updateItem: (id: string, patch: Partial<ItemInput> & { soldOut?: boolean }) =>
    call<MenuItem>(`/api/menu-items/${id}`, "PATCH", patch),
  deleteItem: (id: string) => call(`/api/menu-items/${id}`, "DELETE"),
  archiveItem: (id: string) => call<MenuItem>(`/api/menu-items/${id}/archive`, "POST"),
  unarchiveItem: (id: string) => call<MenuItem>(`/api/menu-items/${id}/unarchive`, "POST"),
};

const SENTENCES: Record<string, string> = {
  offline: "We couldn't reach Tawilati. Check your connection and try again.",
  unauthorized: "Your session ended. Sign in again to keep editing.",
  forbidden: "Only the business owner can change the menu.",
  validation_error: "Check the details and try again.",
  category_already_exists: "A category with this name already exists.",
  category_not_found: "That category no longer exists. Refresh the page.",
  category_has_items: "Move or remove this category's items first. Archived items count too.",
  category_not_in_business: "Pick one of your categories.",
  menu_item_not_found: "That item no longer exists. Refresh the page.",
  menu_item_already_archived: "That item is already archived.",
  menu_item_in_use: "This item has been ordered, so it can't be deleted. Archive it instead.",
  menu_item_not_archived: "That item is not archived.",
};

export function sentenceFor(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  return SENTENCES[code] ?? "Something went wrong on our side. Please try again in a moment.";
}

// "2.5" or "2,50" → 2.5. Null when it isn't a positive amount with at most two decimals.
// Same ceiling as the server (MAX_PRICE_USD in menuItemsSchemas.ts).
const MAX_PRICE_USD = 99_999;

export function parsePriceUSD(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 && value <= MAX_PRICE_USD ? value : null;
}

// The sentence to show under the price field, or undefined when the text is fine (or still empty).
export function priceHint(text: string): string | undefined {
  const cleaned = text.trim().replace(",", ".");
  if (!cleaned) return undefined;
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === ".") return "Use numbers only, like 3.50.";
  if (/\.\d{3,}/.test(cleaned)) return "Use at most two decimals, like 3.50.";
  const value = Number(cleaned);
  if (value <= 0) return "The price must be at least $0.01.";
  if (value > MAX_PRICE_USD) return "The price can't be more than $99,999.";
  return undefined;
}

export function formatUSD(amount: string): string {
  return `$${Number(amount).toFixed(2)}`;
}

export function formatLBP(amount: string): string {
  return `${Math.round(Number(amount)).toLocaleString("en-US")} LBP`;
}
