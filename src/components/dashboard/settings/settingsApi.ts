// The owner's settings screen talks to /api/business: read the business, change the exchange rate and/or timezone.
// Error codes never reach the person: `settingsSentenceFor` turns each one into a sentence.
import { ApiError, call } from "../api";

export type BusinessSettings = {
  id: string;
  name: string;
  // A decimal as a string, e.g. "89500" or "89500.5".
  exchangeRate: string;
  timezone: string;
};

// Same list as TIMEZONES in businessSchemas.ts, with the names an owner recognises.
export const TIMEZONE_OPTIONS = [
  { value: "Asia/Beirut", label: "Beirut", description: "Asia/Beirut" },
  { value: "Asia/Dubai", label: "Dubai", description: "Asia/Dubai" },
  { value: "Europe/Paris", label: "Paris", description: "Europe/Paris" },
  { value: "UTC", label: "UTC", description: "Coordinated Universal Time" },
];

export const settingsApi = {
  get: () => call<BusinessSettings>("/api/business", "GET"),
  // The rate goes as a string so no float rounding happens on the way.
  setExchangeRate: (exchangeRate: string) => call<BusinessSettings>("/api/business", "PATCH", { exchangeRate }),
  setTimezone: (timezone: string) => call<BusinessSettings>("/api/business", "PATCH", { timezone }),
};

// Same limits as the server (BusinessService): above 0, below 1,000,000, at most 4 decimals.
const MAX_RATE = 1_000_000;

// Commas and spaces are read as thousands separators ("89,500" → "89500").
function clean(text: string): string {
  return text.trim().replace(/[,\s]/g, "");
}

// "89,500" → "89500". Null when it isn't a rate the server would accept.
export function parseRate(text: string): string | null {
  const cleaned = clean(text);
  if (!/^\d+(\.\d{1,4})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!(value > 0 && value < MAX_RATE)) return null;
  // Drop leading zeros and trailing decimal zeros so "089500.50" compares equal to "89500.5".
  return normaliseRate(cleaned);
}

// The sentence to show under the rate field, or undefined when the text is fine (or still empty).
export function rateHint(text: string): string | undefined {
  const cleaned = clean(text);
  if (!cleaned) return undefined;
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === ".") return "Use numbers only, like 89500.";
  if (/\.\d{5,}/.test(cleaned)) return "Use at most four decimals.";
  const value = Number(cleaned);
  if (value <= 0) return "The rate must be more than 0.";
  if (value >= MAX_RATE) return "The rate must be below 1,000,000.";
  return undefined;
}

// "0089500.5000" → "89500.5", "89500.0" → "89500".
export function normaliseRate(rate: string): string {
  const [whole, decimals = ""] = rate.split(".");
  const trimmedWhole = whole.replace(/^0+(?=\d)/, "");
  const trimmedDecimals = decimals.replace(/0+$/, "");
  return trimmedDecimals ? `${trimmedWhole}.${trimmedDecimals}` : trimmedWhole;
}

// "89500.5" → "89,500.5". Split as a string, so no float touches the rate.
export function formatRate(rate: string): string {
  const [whole, decimals] = normaliseRate(rate).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimals ? `${grouped}.${decimals}` : grouped;
}

export function timezoneLabel(timezone: string): string {
  return TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label ?? timezone;
}

const SENTENCES: Record<string, string> = {
  offline: "We couldn't reach Tawilati. Check your connection and try again.",
  unauthorized: "Your session ended. Sign in again to keep editing.",
  forbidden: "Only the business owner can change the settings.",
  validation_error: "Check the details and try again.",
  // The form already refuses a rate out of range, so the server only says this when the rate
  // would push the most expensive item past the highest LBP price we can store.
  invalid_exchange_rate: "This rate is too high for your most expensive menu item. Lower the rate or that item's price.",
  invalid_timezone: "Pick one of the timezones in the list.",
  not_found: "We couldn't find your business. Sign in again.",
};

export function settingsSentenceFor(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  return SENTENCES[code] ?? "Something went wrong on our side. Please try again in a moment.";
}
