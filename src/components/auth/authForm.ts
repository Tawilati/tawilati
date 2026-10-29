import type { z } from "zod";
import { homeFor } from "@/components/staff/navigation";
import { toRole } from "@/types/Roles";

// Turns what the sign-in and sign-up forms get back (from Zod or from /api/auth/*) into
// sentences for the screen. Error codes never reach the person.

export type AuthMode = "login" | "register";
export type AuthField = "businessName" | "ownerName" | "email" | "password";
export type FieldErrors = Partial<Record<AuthField, string>>;
export type FormMessage = { title: string; body?: string };
export type AuthErrors = { fields: FieldErrors; form?: FormMessage };

// One sentence per field, whatever rule it broke: it says how to fix it.
const FIELD_SENTENCES: Record<AuthMode, Partial<Record<AuthField, string>>> = {
  login: {
    email: "Enter your email address, like name@business.com.",
    password: "Enter your password.",
  },
  register: {
    businessName: "Enter the business name: 2 to 100 characters, with at least one letter.",
    ownerName: "Enter the owner's name, up to 100 characters.",
    email: "Enter a valid email address, like name@business.com.",
    password: "Use at least 8 characters, with a letter and a number.",
  },
};

export const BUSINESS_NAME_TAKEN = "Another business already uses this name. Try adding your area or street to it.";

export const OFFLINE: FormMessage = {
  title: "We couldn't reach Tawilati",
  body: "Check your connection and try again.",
};

const SERVER_TROUBLE: FormMessage = {
  title: "Something went wrong on our side",
  body: "Please try again in a moment.",
};

function sentencesFor(mode: AuthMode, fields: string[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fields) {
    const sentence = FIELD_SENTENCES[mode][field as AuthField];
    if (sentence) errors[field as AuthField] = sentence;
  }
  return errors;
}

// Checks the form before sending, with the same schema the route uses.
export function checkFields(mode: AuthMode, schema: z.ZodType, values: unknown): FieldErrors {
  const result = schema.safeParse(values);
  if (result.success) return {};
  return sentencesFor(mode, result.error.issues.map((issue) => String(issue.path[0])));
}

// Checks one field when the person leaves it. An empty field is left alone until they submit.
export function checkField(
  mode: AuthMode,
  schema: z.ZodType,
  field: AuthField,
  values: Partial<Record<AuthField, string>>,
): string | undefined {
  if (!values[field]?.trim()) return undefined;
  return checkFields(mode, schema, values)[field];
}

// The API's error shape: { success: false, message: "<code>", details? }.
export function errorsFromResponse(mode: AuthMode, body: unknown): AuthErrors {
  const { message, details } = (body ?? {}) as { message?: unknown; details?: unknown };

  switch (message) {
    case "validation_error": {
      const fields = sentencesFor(mode, Object.keys(details ?? {}));
      return Object.keys(fields).length > 0 ? { fields } : { fields, form: SERVER_TROUBLE };
    }
    case "invalid_credentials":
    case "inactive user": // 403 from the login route for a turned-off account with the right password
      // Same sentence for a wrong password, an unknown email and a turned-off account.
      return {
        fields: {},
        form: {
          title: "Email or password is incorrect",
          body: "Check them and try again. If you're staff and still can't sign in, ask the business owner.",
        },
      };
    case "email_already_in_use":
      return { fields: { email: "An account already uses this email. Sign in instead, or use another email." } };
    case "business_name_taken":
      return { fields: { businessName: BUSINESS_NAME_TAKEN } };
    default:
      return { fields: {}, form: SERVER_TROUBLE };
  }
}

// Where a person lands after signing in: the first screen of their role.
export function destinationFor(role: unknown): string | null {
  const known = typeof role === "string" ? toRole(role) : undefined;
  return known ? homeFor(known) : null;
}
