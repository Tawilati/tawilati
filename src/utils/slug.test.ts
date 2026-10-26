import { describe, expect, it } from "vitest";
import { makeSlug, SLUG_PATTERN, slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Tawilati Demo Café", "tawilati-demo-cafe"],
    ["T1", "t1"],
    ["Terrace 2", "terrace-2"],
    ["Za'atar & Co.", "zaatar-co"],
    ["  --Café   Hamra--  ", "cafe-hamra"],
    ["Crème Brûlée", "creme-brulee"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("returns an empty string when nothing Latin is left", () => {
    expect(slugify("مقهى طاولتي")).toBe("");
  });

  it("caps the length at 60 without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(59)} b`);
    expect(slug).toBe("a".repeat(59));
    expect(slugify("word ".repeat(30)).length).toBeLessThanOrEqual(60);
  });
});

describe("makeSlug", () => {
  it("uses the slug of the text when there is one", () => {
    expect(makeSlug("Café Hamra", "cafe")).toBe("cafe-hamra");
  });

  it("falls back to the prefix and a random suffix for names with no Latin letters", () => {
    const slug = makeSlug("مقهى طاولتي", "cafe");
    expect(slug).toMatch(/^cafe-[0-9a-f]{6}$/);
    expect(slug).toMatch(SLUG_PATTERN);
  });
});
