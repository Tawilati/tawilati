"use client";

import type { FormEvent } from "react";
import { MailIcon } from "@/components/icons";
import { Button, PasswordField, TextField, Toast } from "@/components/ui";
import { loginSchema } from "@/validation/User";
import type { AuthErrors } from "./authForm";
import { useAuthForm } from "./useAuthForm";

const FIELDS = ["email", "password"] as const;

export function LoginForm() {
  const { errors, pending, submit, clearField, checkOnLeave } = useAuthForm("login", loginSchema);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const shown = await submit({ email: String(data.get("email") ?? ""), password: String(data.get("password") ?? "") });
    focusFirstError(form, shown);
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {errors.form && (
        <Toast tone="error" title={errors.form.title}>
          {errors.form.body}
        </Toast>
      )}
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
        onBlur={(event) => checkOnLeave("email", { email: event.currentTarget.value })}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        error={errors.fields.password}
        onChange={() => clearField("password")}
      />
      <Button type="submit" block loading={pending} className="mt-1">
        Sign in
      </Button>
      <p className="text-center text-[13px] text-ink-muted">
        Staff: your business owner creates your account. Ask them for your email and password.
      </p>
    </form>
  );
}

function focusFirstError(form: HTMLFormElement, shown: AuthErrors) {
  const first = FIELDS.find((field) => shown.fields[field]);
  if (first) (form.elements.namedItem(first) as HTMLInputElement | null)?.focus();
}
