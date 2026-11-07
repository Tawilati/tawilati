// The kitchen screens talk to /api/kitchen/orders (the queue), /api/kitchen/:id (Start, Ready), and for Sold out
// to /api/categories, /api/menu-items and /api/menu-items/:id/soldout.
// Error codes never reach the cook: `kitchenSentenceFor` turns each one into a sentence.
import { ApiError, call } from "@/components/dashboard/api";
import type { KitchenTicket } from "@/utils/kitchenQueue";
import type { BoardItem } from "@/utils/soldOutBoard";

export type BoardCategory = { id: string; name: string };

export const kitchenApi = {
  queue: () => call<KitchenTicket[]>("/api/kitchen/orders", "GET"),
  setStatus: (orderId: string, status: "PREPARING" | "READY") =>
    call<{ orderId: string; status: string }>(`/api/kitchen/${orderId}`, "PATCH", { status }),
  categories: () => call<BoardCategory[]>("/api/categories", "GET"),
  items: () => call<BoardItem[]>("/api/menu-items", "GET"),
  setSoldOut: (itemId: string, soldOut: boolean) =>
    call<{ id: string; soldOut: boolean }>(`/api/menu-items/${itemId}/soldout`, "PATCH", { soldOut }),
};

const SENTENCES: Record<string, string> = {
  offline: "We couldn't reach Tawilati. Check the connection and tap again.",
  unauthorized: "Your session ended. Sign in again.",
  // Another tab signed this browser in with another role.
  forbidden: "This browser is signed in with another account. Sign in again as the kitchen.",
  // Someone else (another kitchen screen) moved the ticket first: the queue refreshes.
  invalid_transition: "This ticket was already updated on another screen.",
  not_found: "This ticket is no longer there.",
  menu_item_not_found: "This item is no longer on the menu. The list has been refreshed.",
  validation_error: "This item is no longer on the menu. The list has been refreshed.",
};

export function kitchenSentenceFor(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  return SENTENCES[code] ?? "Something went wrong on our side. Please tap again in a moment.";
}
