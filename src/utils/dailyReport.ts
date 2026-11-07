// What the owner's daily report shows. Pure logic, no React or fetching.
import { fromCents, toCents } from "@/utils/money";

export type Direction = "up" | "down" | "same";

// The day's takings against the day before.
export function moneyChange(dayUSD: string, beforeUSD: string): { direction: Direction; amountUSD: string } {
  const diff = toCents(dayUSD) - toCents(beforeUSD);
  return { direction: diff > 0 ? "up" : diff < 0 ? "down" : "same", amountUSD: fromCents(Math.abs(diff)) };
}

export function countChange(day: number, before: number): { direction: Direction; amount: number } {
  const diff = day - before;
  return { direction: diff > 0 ? "up" : diff < 0 ? "down" : "same", amount: Math.abs(diff) };
}

// "2026-11-04" → "Wed 4 Nov 2026". Read as a calendar day, so the browser's timezone can't shift it.
export function dayLabel(date: string, { year = true }: { year?: boolean } = {}): string {
  const [y, m, d] = date.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  const weekday = at.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const month = at.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return `${weekday} ${d} ${month}${year ? ` ${y}` : ""}`;
}

// A bar's length in %, against the longest. Anything above zero keeps a sliver so it stays visible.
export function barWidth(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(2, Math.round((value / max) * 100));
}
