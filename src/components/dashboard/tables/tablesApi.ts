// The owner's tables screen talks to /api/tables. The QR token never reaches the browser: a table's sticker comes
// from /api/tables/:id/qr as a finished PNG. Error codes never reach the person: `tableSentenceFor` turns each one into a sentence.
import { ApiError, call } from "../api";

export type DiningTable = {
  id: string;
  label: string;
  slug: string;
  isDisabled: boolean;
  createdAt: string;
};

export const tablesApi = {
  list: () => call<DiningTable[]>("/api/tables", "GET"),
  add: (label: string) => call<DiningTable>("/api/tables", "POST", { label }),
  rename: (id: string, label: string) => call<DiningTable>(`/api/tables/${id}`, "PATCH", { label }),
  disable: (id: string) => call<DiningTable>(`/api/tables/${id}/disable`, "POST"),
  enable: (id: string) => call<DiningTable>(`/api/tables/${id}/enable`, "POST"),
};

// The sticker's address. `label` is only there so a renamed table's sticker isn't served from the browser's cache.
export function stickerUrl(table: Pick<DiningTable, "id" | "label">): string {
  return `/api/tables/${table.id}/qr?v=${encodeURIComponent(table.label)}`;
}

// Fetches the sticker and saves it as tawilati-<table slug>.png.
export async function downloadSticker(table: DiningTable): Promise<void> {
  let response: Response;
  try {
    response = await fetch(stickerUrl(table));
  } catch {
    throw new ApiError("offline", 0);
  }
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new ApiError(String(json?.message ?? "internal_server_error"), response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `tawilati-${table.slug}.png`;
  link.click();
  URL.revokeObjectURL(url);
}

const SENTENCES: Record<string, string> = {
  offline: "We couldn't reach Tawilati. Check your connection and try again.",
  unauthorized: "Your session ended. Sign in again to keep editing.",
  forbidden: "Only the business owner can manage tables.",
  validation_error: "Enter a table name of up to 50 characters.",
  // table_label_exists from adding, label_already_taken from a rename that clashes in the database.
  table_label_exists: "You already have a table with this name. Pick another one.",
  label_already_taken: "You already have a table with this name. Pick another one.",
  not_found: "That table no longer exists. Refresh the page.",
};

export function tableSentenceFor(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  return SENTENCES[code] ?? "Something went wrong on our side. Please try again in a moment.";
}
