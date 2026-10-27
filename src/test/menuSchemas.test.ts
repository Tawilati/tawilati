import { describe, expect, it } from "vitest";
import { publicMenuQuerySchema } from "@/validation/menuSchemas";

const TOKEN = "0123456789abcdef".repeat(4);

describe("publicMenuQuerySchema", () => {
  it("reads b as the business slug and t as the table token", () => {
    expect(publicMenuQuerySchema.parse({ b: "cafe-hamra", t: TOKEN })).toEqual({
      businessSlug: "cafe-hamra",
      qrToken: TOKEN,
    });
  });

  it.each([
    ["missing b", { t: TOKEN }],
    ["missing t", { b: "cafe-hamra" }],
    ["b with spaces", { b: "cafe hamra", t: TOKEN }],
    ["b uppercase", { b: "Cafe-Hamra", t: TOKEN }],
    ["b with a trailing hyphen", { b: "cafe-", t: TOKEN }],
    ["b longer than 60", { b: "a".repeat(61), t: TOKEN }],
    ["t too short", { b: "cafe-hamra", t: "abc123" }],
    ["t not hex", { b: "cafe-hamra", t: "z".repeat(64) }],
    ["t uppercase", { b: "cafe-hamra", t: TOKEN.toUpperCase() }],
  ])("rejects %s", (_label, query) => {
    expect(publicMenuQuerySchema.safeParse(query).success).toBe(false);
  });
});
