// The kitchen screen talks to /api/kitchen/orders (the queue) and /api/kitchen/:id (Start, Ready).
// Error codes never reach the cook: `kitchenSentenceFor` turns each one into a sentence.
import { ApiError, call } from "@/components/dashboard/api";
import type { KitchenTicket } from "@/utils/kitchenQueue";

export const kitchenApi = {
  queue: () => call<KitchenTicket[]>("/api/kitchen/orders", "GET"),
  setStatus: (orderId: string, status: "PREPARING" | "READY") =>
    call<{ orderId: string; status: string }>(`/api/kitchen/${orderId}`, "PATCH", { status }),
};

const SENTENCES: Record<string, string> = {
  offline: "We couldn't reach Tawilati. Check the connection and tap again.",
  unauthorized: "Your session ended. Sign in again.",
  forbidden: "This account can't update tickets. Ask the owner.",
  // Someone else (another kitchen screen) moved the ticket first: the queue refreshes.
  invalid_transition: "This ticket was already updated on another screen.",
  not_found: "This ticket is no longer there.",
};

export function kitchenSentenceFor(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  return SENTENCES[code] ?? "Something went wrong on our side. Please tap again in a moment.";
}
