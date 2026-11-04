// Calendar days on the café's clock. A report day runs from local midnight to local midnight,
// whatever the server's timezone. Dates are "YYYY-MM-DD" strings; no library, only Intl.

const DAY_MS = 24 * 60 * 60 * 1000;

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function format(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

// "2026-02-29" doesn't exist, so it's refused rather than rolled over to 1 March.
export function isCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = parts(date);
  return format(Date.UTC(y, m - 1, d)) === date;
}

// Today's date on the café's clock.
export function todayIn(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function previousDay(date: string): string {
  const [y, m, d] = parts(date);
  return format(Date.UTC(y, m - 1, d) - DAY_MS);
}

export function nextDay(date: string): string {
  const [y, m, d] = parts(date);
  return format(Date.UTC(y, m - 1, d) + DAY_MS);
}

// How far the café's clock is ahead of UTC at this instant, in ms.
function offsetAt(timezone: string, utcMs: number): number {
  const fields = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(fields.find((f) => f.type === type)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return local - Math.floor(utcMs / 1000) * 1000;
}

// The first instant of the day on the café's clock. On the night the clocks go forward at midnight,
// the day starts at the first time that exists (01:00 in Beirut).
function startOf(date: string, timezone: string): number {
  const [y, m, d] = parts(date);
  const midnight = Date.UTC(y, m - 1, d);
  const guess = midnight - offsetAt(timezone, midnight);
  return midnight - offsetAt(timezone, guess);
}

// The day's first and last millisecond, as UTC instants for the database.
export function dayBounds(date: string, timezone: string): { start: Date; end: Date } {
  return { start: new Date(startOf(date, timezone)), end: new Date(startOf(nextDay(date), timezone) - 1) };
}
