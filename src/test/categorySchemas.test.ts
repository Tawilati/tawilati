import { describe, expect, it } from "vitest";
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/validation/categorySchemas";

describe("createCategorySchema", () => {
  it("accepts a valid category name", () => {
    expect(createCategorySchema.parse({ name: "Drinks" })).toEqual({
      name: "Drinks",
    });
  });

  it("trims whitespace from the name", () => {
    expect(createCategorySchema.parse({ name: "  Drinks  " })).toEqual({
      name: "Drinks",
    });
  });

  it.each([
    ["empty name", { name: "" }],
    ["whitespace-only name", { name: "   " }],
    ["name longer than 50 characters", { name: "a".repeat(51) }],
    ["unexpected fields", { name: "Drinks", businessId: "another-business" }],
  ])("rejects %s", (_label, input) => {
    expect(createCategorySchema.safeParse(input).success).toBe(false);
  });

  it("accepts a name of exactly 50 characters", () => {
    expect(createCategorySchema.parse({ name: "a".repeat(50) }).name).toBe(
      "a".repeat(50),
    );
  });
});

describe("updateCategorySchema", () => {
  it("accepts a valid name update", () => {
    expect(updateCategorySchema.parse({ name: "Desserts" })).toEqual({
      name: "Desserts",
    });
  });

  it.each([
    ["empty name", { name: "" }],
    ["whitespace-only name", { name: "   " }],
    ["name longer than 50 characters", { name: "a".repeat(51) }],
    ["unexpected fields", { name: "Desserts", businessId: "another-business" }],
    ["missing name", {}],
  ])("rejects %s", (_label, input) => {
    expect(updateCategorySchema.safeParse(input).success).toBe(false);
  });
});