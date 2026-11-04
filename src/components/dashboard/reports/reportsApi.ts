// The owner's daily report: GET /api/reports/daily, one day per call. Without a date the server
// answers today on the café's clock. Error codes never reach the owner: `reportsSentenceFor` turns each one into a sentence.
import { ApiError, call } from "@/components/dashboard/api";
import type { DailyReportResponse } from "@/types/Report";

export const reportsApi = {
  daily: (date?: string) =>
    call<DailyReportResponse>(`/api/reports/daily${date ? `?date=${encodeURIComponent(date)}` : ""}`, "GET"),
};

const SENTENCES: Record<string, string> = {
  offline: "We couldn't reach Tawilati. Check the connection and try again.",
  unauthorized: "Your session ended. Sign in again.",
  forbidden: "Only the owner can see the reports.",
  validation_error: "That date doesn't exist. Pick another day.",
};

export function reportsSentenceFor(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  return SENTENCES[code] ?? "We couldn't load the report. Please try again.";
}
