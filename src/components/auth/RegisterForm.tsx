"use client";

import { useRef, useState, type FocusEvent, type FormEvent } from "react";
import { MailIcon } from "@/components/icons";
import { Button, PasswordField, TextField, Toast } from "@/components/ui";
import { registerUserRequestSchema } from "@/validation/User";
import { BUSINESS_NAME_TAKEN, type AuthErrors, type AuthField } from "./authForm";
import { PasswordRules } from "./PasswordRules";
import { useAuthForm } from "./useAuthForm";

const FIELDS = ["businessName", "ownerName", "email", "password"] as const;
const PASSWORD_ID = "register-password";
const PASSWORD_RULES_ID = "register-password-rules";

export function RegisterForm() {
  const { errors, pending, submit, clearField, checkOnLeave, setFieldError } = useAuthForm(
    "register",
    registerUserRequestSchema,
  );
  const [password, setPassword] = useState("");
  // The button stays off until every field has something in it.
  const [allFilled, setAllFilled] = useState(false);
  // Bumped on every keystroke in the name field, so an older "is it free?" answer is ignored.
  const nameCheck = useRef(0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const shown = await submit(Object.fromEntries(FIELDS.map((field) => [field, String(data.get(field) ?? "")])));
    focusFirstError(form, shown);
  }

  function onFormChange(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    setAllFilled(FIELDS.every((field) => String(data.get(field) ?? "").trim() !== ""));
  }

  function onLeave(field: AuthField) {
    return (event: FocusEvent<HTMLInputElement>) => checkOnLeave(field, { [field]: event.currentTarget.value });
  }

  // Leaving the name field: check the rules, then ask the server whether the name is free.
  async function onBusinessNameLeave(event: FocusEvent<HTMLInputElement>) {
    const name = event.currentTarget.value.trim();
    if (!checkOnLeave("businessName", { businessName: name }) || !name) return;
    const ticket = ++nameCheck.current;
    if ((await isBusinessNameTaken(name)) && ticket === nameCheck.current) {
      setFieldError("businessName", BUSINESS_NAME_TAKEN);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} onChange={onFormChange} className="flex flex-col gap-4">
      {errors.form && (
        <Toast tone="error" title={errors.form.title}>
          {errors.form.body}
        </Toast>
      )}
      <TextField
        label="Business name"
        name="businessName"
        autoComplete="organization"
        hint="Guests see it on the menu."
        maxLength={100}
        error={errors.fields.businessName}
        onChange={() => {
          nameCheck.current++;
          clearField("businessName");
        }}
        onBlur={onBusinessNameLeave}
      />
      <TextField
        label="Owner name"
        name="ownerName"
        autoComplete="name"
        maxLength={100}
        error={errors.fields.ownerName}
        onChange={() => clearField("ownerName")}
        onBlur={onLeave("ownerName")}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        icon={<MailIcon className="size-5 shrink-0" />}
        error={errors.fields.email}
        onChange={() => clearField("email")}
        onBlur={onLeave("email")}
      />
      <PasswordField
        id={PASSWORD_ID}
        label="Password"
        name="password"
        autoComplete="new-password"
        maxLength={100}
        // The checklist below says what is missing, so the message only introduces it.
        error={errors.fields.password && "Your password needs:"}
        aria-describedby={
          errors.fields.password ? `${PASSWORD_ID}-message ${PASSWORD_RULES_ID}` : PASSWORD_RULES_ID
        }
        onChange={(event) => {
          setPassword(event.currentTarget.value);
          clearField("password");
        }}
        onBlur={onLeave("password")}
      />
      <PasswordRules id={PASSWORD_RULES_ID} password={password} showMissing={Boolean(errors.fields.password)} />
      <Button type="submit" block loading={pending} disabled={!allFilled} className="mt-1">
        Create my business
      </Button>
    </form>
  );
}

// Asks GET /api/auth/business-name. Any failure counts as "not taken": submit checks again anyway.
async function isBusinessNameTaken(name: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/auth/business-name?name=${encodeURIComponent(name)}`);
    if (!response.ok) return false;
    const body = await response.json();
    return body?.data?.available === false;
  } catch {
    return false;
  }
}

function focusFirstError(form: HTMLFormElement, shown: AuthErrors) {
  const first = FIELDS.find((field) => shown.fields[field]);
  if (first) (form.elements.namedItem(first) as HTMLInputElement | null)?.focus();
}
