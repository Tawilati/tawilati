import { describe, expect, it } from "vitest";
import { registerUserRequestSchema } from "@/validation/User";

describe("registerUserRequestSchema", () => {
  it("accepts valid registration data and trims names and email", () => {
    expect(
      registerUserRequestSchema.parse({
        businessName: "  Tawilati Cafe  ",
        ownerName: "  Sam  ",
        email: "  sam@example.com  ",
        password: "password123",
      })
    ).toEqual({
      businessName: "Tawilati Cafe",
      ownerName: "Sam",
      email: "sam@example.com",
      password: "password123",
    });
  });

  it.each([
    ["empty business name", { businessName: "  " }],
    ["empty owner name", { ownerName: "  " }],
    ["invalid email", { email: "not-an-email" }],
    ["short password", { password: "short" }],
  ])("rejects %s", (_label, override) => {
    expect(
      registerUserRequestSchema.safeParse({
        businessName: "Tawilati Cafe",
        ownerName: "Sam",
        email: "sam@example.com",
        password: "password123",
        ...override,
      }).success
    ).toBe(false);
  });
});
