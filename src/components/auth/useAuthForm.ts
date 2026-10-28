"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import {
  checkField,
  checkFields,
  destinationFor,
  errorsFromResponse,
  OFFLINE,
  type AuthErrors,
  type AuthField,
  type AuthMode,
} from "./authForm";

const NO_ERRORS: AuthErrors = { fields: {} };

// Checks the form, posts it to /api/auth/{login|register} and, on success, opens the role's first screen.
// The auth cookies come back on that response, so nothing is stored in the browser here.
export function useAuthForm(mode: AuthMode, schema: z.ZodType) {
  const router = useRouter();
  const [errors, setErrors] = useState<AuthErrors>(NO_ERRORS);
  const [pending, setPending] = useState(false);

  // Returns the errors it shows, so the form can move focus to the first one.
  async function submit(values: Partial<Record<AuthField, string>>): Promise<AuthErrors> {
    const fields = checkFields(mode, schema, values);
    if (Object.keys(fields).length > 0) return show({ fields });

    setPending(true);
    setErrors(NO_ERRORS);
    let response: Response;
    try {
      response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      return show({ fields: {}, form: OFFLINE });
    }

    const body = await response.json().catch(() => null);
    if (response.ok) {
      const destination = destinationFor(body?.data?.role);
      if (destination) {
        // Stay "loading" until the next screen replaces this one.
        router.replace(destination);
        return NO_ERRORS;
      }
    }
    return show(errorsFromResponse(mode, body));
  }

  function show(next: AuthErrors): AuthErrors {
    setPending(false);
    setErrors(next);
    return next;
  }

  function setFieldError(field: AuthField, message: string | undefined) {
    setErrors((current) =>
      current.fields[field] === message ? current : { ...current, fields: { ...current.fields, [field]: message } },
    );
  }

  // Typing in a field clears its message; the form message stays until the next try.
  function clearField(field: AuthField) {
    setFieldError(field, undefined);
  }

  // Leaving a field shows its message straight away, instead of waiting for submit.
  // Returns true when the field is fine.
  function checkOnLeave(field: AuthField, values: Partial<Record<AuthField, string>>): boolean {
    const message = checkField(mode, schema, field, values);
    setFieldError(field, message);
    return !message;
  }

  return { errors, pending, submit, clearField, checkOnLeave, setFieldError };
}
