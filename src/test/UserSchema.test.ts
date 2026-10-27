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

  it("accepts an Arabic business name and an Arabic-letter password", () => {
    expect(
      registerUserRequestSchema.safeParse({
        businessName: "مقهى طاولتي",
        ownerName: "Sam",
        email: "sam@example.com",
        password: "كلمةسر123",
      }).success
    ).toBe(true);
  });

  it.each([
    ["empty business name", { businessName: "  " }],
    ["empty owner name", { ownerName: "  " }],
    ["invalid email", { email: "not-an-email" }],
    ["short password", { password: "short" }],
    ["one-character business name", { businessName: "A" }],
    ["business name with no letter", { businessName: "123 - 456" }],
    ["password with no number", { password: "onlyletters" }],
    ["password with no letter", { password: "12345678" }],
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
