import { describe, expect, it } from "vitest";
import { ApiError, formatLBP, formatUSD, parsePriceUSD, sentenceFor } from "@/components/dashboard/menu/menuApi";

describe("parsePriceUSD", () => {
  it("accepts amounts with up to two decimals, comma or dot", () => {
    expect(parsePriceUSD("3")).toBe(3);
    expect(parsePriceUSD(" 2.5 ")).toBe(2.5);
    expect(parsePriceUSD("2,50")).toBe(2.5);
  });

  it("rejects zero, negatives, three decimals and text", () => {
    for (const bad of ["", "0", "0.00", "-1", "1.234", "abc", "1e3"]) expect(parsePriceUSD(bad)).toBeNull();
  });
});

describe("formatting", () => {
  it("shows USD with two decimals and LBP with separators", () => {
    expect(formatUSD("2.5")).toBe("$2.50");
    expect(formatLBP("224000.00")).toBe("224,000 LBP");
  });
});

describe("sentenceFor", () => {
  it("maps known codes to sentences and never shows the code", () => {
    const sentence = sentenceFor(new ApiError("category_has_items", 409));
    expect(sentence).toMatch(/items first/);
    expect(sentence).not.toContain("category_has_items");
  });

  it("falls back to a generic sentence", () => {
    expect(sentenceFor(new ApiError("weird", 500))).toMatch(/went wrong/);
    expect(sentenceFor(new Error("x"))).toMatch(/went wrong/);
  });
});
