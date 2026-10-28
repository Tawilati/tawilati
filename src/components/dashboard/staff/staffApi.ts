// The owner's staff screen talks to /api/staff. The API has no delete: deactivating is how an account is removed,
// and it can be undone. Error codes never reach the person: `staffSentenceFor` turns each one into a sentence.
import { ApiError, call } from "../api";

export type StaffRole = "WAITER" | "KITCHEN";

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
};

export type NewStaff = { name: string; email: string; password: string; role: StaffRole };
export type StaffPatch = { name?: string; role?: StaffRole; isActive?: boolean };

export const ROLE_OPTIONS: { value: StaffRole; label: string; description: string }[] = [
  { value: "WAITER", label: "Waiter", description: "Serves tables, takes payment and closes bills" },
  { value: "KITCHEN", label: "Kitchen", description: "Sees incoming orders and marks them ready" },
];

export const staffApi = {
  list: () => call<StaffMember[]>("/api/staff", "GET"),
  add: (input: NewStaff) => call<StaffMember>("/api/staff", "POST", input),
  update: (id: string, patch: StaffPatch) => call<StaffMember>(`/api/staff/${id}`, "PATCH", patch),
};

const SENTENCES: Record<string, string> = {
  offline: "We couldn't reach Tawilati. Check your connection and try again.",
  unauthorized: "Your session ended. Sign in again to keep editing.",
  forbidden: "Only the business owner can manage staff.",
  validation_error: "Check the details and try again.",
  email_already_in_use: "This email already has an account. Use a different one.",
  not_found: "That account no longer exists. Refresh the page.",
};

export function staffSentenceFor(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  return SENTENCES[code] ?? "Something went wrong on our side. Please try again in a moment.";
}

export function roleLabel(role: StaffRole): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

// The sentence to show under the email field, or undefined when it looks fine (or is still empty).
export function emailHint(text: string): string | undefined {
  const email = text.trim();
  if (!email) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? undefined : "Enter a valid email";
}
