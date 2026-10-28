import { describe, expect, it } from "vitest";
import { checkField, checkFields, destinationFor, errorsFromResponse } from "@/components/auth/authForm";
import { loginSchema, registerUserRequestSchema } from "@/validation/User";

const validSignup = { businessName: "Café Hamra", ownerName: "Souad", email: "souad@cafe.com", password: "Secret123" };

describe("checkFields", () => {
  it("passes a valid sign-up", () => {
    expect(checkFields("register", registerUserRequestSchema, validSignup)).toEqual({});
  });

  it("gives one sentence per broken field", () => {
    const errors = checkFields("register", registerUserRequestSchema, {
      ...validSignup,
      businessName: "  ",
      email: "souad@",
      password: "short",
    });

    expect(Object.keys(errors).sort()).toEqual(["businessName", "email", "password"]);
    expect(errors.password).toBe("Use at least 8 characters, with a letter and a number.");
  });

  it("checks a single field when it is left, and leaves an empty one alone", () => {
    expect(checkField("register", registerUserRequestSchema, "email", { email: "souad@" })).toBe(
      "Enter a valid email address, like name@business.com.",
    );
    expect(checkField("register", registerUserRequestSchema, "email", { email: "souad@cafe.com" })).toBeUndefined();
    expect(checkField("register", registerUserRequestSchema, "email", { email: "  " })).toBeUndefined();
    expect(checkField("register", registerUserRequestSchema, "businessName", { businessName: "A" })).toMatch(
      /2 to 100 characters/,
    );
  });

  it("only asks for a password at sign-in, not a long one", () => {
    expect(checkFields("login", loginSchema, { email: "souad@cafe.com", password: "abc" })).toEqual({});
    expect(checkFields("login", loginSchema, { email: "souad@cafe.com", password: "" })).toEqual({
      password: "Enter your password.",
    });
  });
});

describe("errorsFromResponse", () => {
  it("puts a taken email and a taken business name under their fields", () => {
    expect(errorsFromResponse("register", { message: "email_already_in_use" }).fields.email).toMatch(/already uses this email/);
    expect(errorsFromResponse("register", { message: "business_name_taken" }).fields.businessName).toMatch(
      /already uses this name/,
    );
  });

  it("shows invalid_credentials as one form message, never the code", () => {
    const { fields, form } = errorsFromResponse("login", { message: "invalid_credentials" });

    expect(fields).toEqual({});
    expect(form?.title).toBe("Email or password is incorrect");
    expect(JSON.stringify(form)).not.toContain("invalid_credentials");
  });

  it("maps validation_error details to the field sentences", () => {
    const { fields, form } = errorsFromResponse("register", {
      message: "validation_error",
      details: { email: ["Invalid email address"], password: ["Too small"] },
    });

    expect(fields).toEqual({
      email: "Enter a valid email address, like name@business.com.",
      password: "Use at least 8 characters, with a letter and a number.",
    });
    expect(form).toBeUndefined();
  });

  it("falls back to a general message for anything else", () => {
    for (const body of [{ message: "internal_server_error" }, { message: "validation_error", details: {} }, null]) {
      expect(errorsFromResponse("login", body).form?.title).toBe("Something went wrong on our side");
    }
  });
});

describe("destinationFor", () => {
  it("sends each role to its first screen", () => {
    expect(destinationFor("OWNER")).toBe("/dashboard/menu");
    expect(destinationFor("KITCHEN")).toBe("/kitchen");
    expect(destinationFor("WAITER")).toBe("/waiter");
  });

  it("returns null for anything that isn't a role", () => {
    expect(destinationFor("ADMIN")).toBeNull();
    expect(destinationFor(undefined)).toBeNull();
  });
});
