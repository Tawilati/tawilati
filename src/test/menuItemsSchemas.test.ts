import { describe, expect, it } from "vitest";
import {
  createMenuItemSchema,
  updateMenuItemSchema,
} from "@/validation/menuItemsSchemas";

const CATEGORY_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("createMenuItemSchema", () => {
  it("accepts a valid menu item", () => {
    expect(
      createMenuItemSchema.parse({
        name: "Latte",
        categoryId: CATEGORY_ID,
        priceUSD: 3.5,
      }),
    ).toEqual({
      name: "Latte",
      categoryId: CATEGORY_ID,
      priceUSD: 3.5,
    });
  });

  it("trims whitespace from the name", () => {
    expect(
      createMenuItemSchema.parse({
        name: "  Latte  ",
        categoryId: CATEGORY_ID,
        priceUSD: 3.5,
      }).name,
    ).toBe("Latte");
  });

  it("accepts an optional soldOut value", () => {
    expect(
      createMenuItemSchema.parse({
        name: "Latte",
        categoryId: CATEGORY_ID,
        priceUSD: 3.5,
        soldOut: true,
      }).soldOut,
    ).toBe(true);
  });

  it.each([
    ["empty name", { name: "", categoryId: CATEGORY_ID, priceUSD: 3.5 }],
    ["whitespace-only name", { name: "   ", categoryId: CATEGORY_ID, priceUSD: 3.5 }],
    ["name longer than 100 characters", { name: "a".repeat(101), categoryId: CATEGORY_ID, priceUSD: 3.5 }],
    ["missing name", { categoryId: CATEGORY_ID, priceUSD: 3.5 }],
    ["missing category", { name: "Latte", priceUSD: 3.5 }],
    ["invalid category ID", { name: "Latte", categoryId: "invalid", priceUSD: 3.5 }],
    ["missing USD price", { name: "Latte", categoryId: CATEGORY_ID }],
    ["zero USD price", { name: "Latte", categoryId: CATEGORY_ID, priceUSD: 0 }],
    ["negative USD price", { name: "Latte", categoryId: CATEGORY_ID, priceUSD: -1 }],
    ["infinite USD price", { name: "Latte", categoryId: CATEGORY_ID, priceUSD: Infinity }],
    ["unexpected fields", { name: "Latte", categoryId: CATEGORY_ID, priceUSD: 3.5, businessId: "another-business" }],
    ["invalid soldOut type", { name: "Latte", categoryId: CATEGORY_ID, priceUSD: 3.5, soldOut: "yes" }],
  ])("rejects %s", (_label, input) => {
    expect(createMenuItemSchema.safeParse(input).success).toBe(false);
  });

  it("accepts a name of exactly 100 characters", () => {
    expect(
      createMenuItemSchema.parse({
        name: "a".repeat(100),
        categoryId: CATEGORY_ID,
        priceUSD: 3.5,
      }).name,
    ).toBe("a".repeat(100));
  });
});

describe("updateMenuItemSchema", () => {
  it("accepts a valid name update", () => {
    expect(updateMenuItemSchema.parse({ name: "Iced Latte" })).toEqual({
      name: "Iced Latte",
    });
  });

  it("accepts a partial price update", () => {
    expect(updateMenuItemSchema.parse({ priceUSD: 4.25 })).toEqual({
      priceUSD: 4.25,
    });
  });

  it("accepts a soldOut update", () => {
    expect(updateMenuItemSchema.parse({ soldOut: true })).toEqual({
      soldOut: true,
    });
  });

  it("trims whitespace from the name", () => {
    expect(updateMenuItemSchema.parse({ name: "  Iced Latte  " }).name).toBe(
      "Iced Latte",
    );
  });

  it.each([
    ["empty update", {}],
    ["empty name", { name: "" }],
    ["whitespace-only name", { name: "   " }],
    ["name longer than 100 characters", { name: "a".repeat(101) }],
    ["invalid category ID", { categoryId: "invalid" }],
    ["zero USD price", { priceUSD: 0 }],
    ["negative USD price", { priceUSD: -1 }],
    ["unexpected fields", { name: "Latte", businessId: "another-business" }],
    ["invalid soldOut type", { soldOut: "yes" }],
  ])("rejects %s", (_label, input) => {
    expect(updateMenuItemSchema.safeParse(input).success).toBe(false);
  });

  it("accepts an update with multiple fields", () => {
    expect(
      updateMenuItemSchema.parse({
        name: "Iced Latte",
        categoryId: CATEGORY_ID,
        priceUSD: 4.25,
        soldOut: false,
      }),
    ).toEqual({
      name: "Iced Latte",
      categoryId: CATEGORY_ID,
      priceUSD: 4.25,
      soldOut: false,
    });
  });
});