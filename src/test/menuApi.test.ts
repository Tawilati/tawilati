import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, formatLBP, formatUSD, menuApi, parsePriceUSD, priceHint, sentenceFor } from "@/components/dashboard/menu/menuApi";

afterEach(() => vi.unstubAllGlobals());

describe("menu API response handling", () => {
  it.each(["not JSON", "null", '{"success":true}'])("rejects an invalid success response: %s", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    await expect(menuApi.items()).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("maps an expired session even when the response is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("expired", { status: 401 })));
    await expect(menuApi.items()).rejects.toMatchObject({ code: "unauthorized", status: 401 });
  });
});

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

describe("priceHint", () => {
  it("says nothing for an empty or valid price", () => {
    expect(priceHint("")).toBeUndefined();
    expect(priceHint("3.50")).toBeUndefined();
    expect(priceHint("3,5")).toBeUndefined();
  });

  it("explains a price that is zero, too precise, too high or not a number", () => {
    expect(priceHint("0")).toMatch(/at least/);
    expect(priceHint("0.00")).toMatch(/at least/);
    expect(priceHint("1.234")).toMatch(/two decimals/);
    expect(priceHint("100000")).toMatch(/more than/);
    expect(priceHint("abc")).toMatch(/numbers only/);
  });

  it("parsePriceUSD refuses a price above the ceiling", () => {
    expect(parsePriceUSD("99999")).toBe(99999);
    expect(parsePriceUSD("100000")).toBeNull();
  });
});
