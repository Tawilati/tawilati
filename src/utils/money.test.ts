import { describe, expect, it } from "vitest";
import { formatLBP, formatUSD } from "./money";

describe("formatUSD", () => {
  it.each([
    ["2.50", "$2.50"],
    ["4.00", "$4.00"],
    ["1250.00", "$1,250.00"],
  ])("%s → %s", (input, expected) => {
    expect(formatUSD(input)).toBe(expected);
  });
});

describe("formatLBP", () => {
  it.each([
    ["223750", "223,750 LBP"],
    ["89500", "89,500 LBP"],
    ["1234567890", "1,234,567,890 LBP"],
    ["0", "0 LBP"],
  ])("%s → %s", (input, expected) => {
    expect(formatLBP(input)).toBe(expected);
  });
});
