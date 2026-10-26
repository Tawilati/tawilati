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
