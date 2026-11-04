// Display formatting for the price strings the API returns ("2.50", "223750").
// Strings are split, not parsed as numbers, so no float ever touches a price.

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// "2.50" → "$2.50"
export function formatUSD(amount: string): string {
  const [whole, cents = "00"] = amount.split(".");
  return `$${groupThousands(whole)}.${cents.padEnd(2, "0")}`;
}

// "223750" → "223,750 LBP"
export function formatLBP(amount: string): string {
  return `${groupThousands(amount.split(".")[0])} LBP`;
}

// "5.00" → 500. For sums and differences in whole cents, so no float ever touches a price.
export function toCents(amount: string): number {
  const [whole, cents = ""] = amount.split(".");
  return Number(whole) * 100 + Number(cents.padEnd(2, "0").slice(0, 2));
}

// 500 → "5.00". Whole, non-negative cents.
export function fromCents(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
