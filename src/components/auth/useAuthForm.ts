"use client";

import { useEffect, useState } from "react";
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
  const [errors, setErrors] = useState<AuthErrors>(NO_ERRORS);
  const [pending, setPending] = useState(false);

  // After a successful submit the form stays "loading" until the next screen replaces it. If the browser
  // later restores this page from its back/forward cache (Back after signing out), it would come back
  // frozen: spinner on, old credentials filled in. Reload it so it starts fresh.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

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
        // Stay "loading" until the next screen replaces this one. A full page load, not router.replace:
        // with cacheComponents the router keeps this page alive in the background, so going back to
        // /login later showed the same form, still spinning with the old credentials in it.
        // `replace`, so Back from the staff screen skips the sign-in page.
        window.location.replace(destination);
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
