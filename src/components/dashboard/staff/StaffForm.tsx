"use client";

import { useState, type FormEvent } from "react";
import { PasswordRules } from "@/components/auth/PasswordRules";
import { Button, PasswordField, SelectField, TextField } from "@/components/ui";
import { PASSWORD_RULES } from "@/validation/User";
import { emailHint, ROLE_OPTIONS, type NewStaff, type StaffMember, type StaffRole } from "./staffApi";

// Add a waiter or kitchen account, or edit one (name and role only: the email is the sign-in and stays put).
export function StaffForm({
  member,
  onSave,
  onCancel,
}: {
  member: StaffMember | null;
  onSave: (input: NewStaff) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>(member?.role ?? "WAITER");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const next = {
      name: name.trim() ? undefined : "Enter their name.",
      email: member ? undefined : !email.trim() ? "Enter their email." : emailHint(email),
      password:
        member || PASSWORD_RULES.every((rule) => rule.test(password))
          ? undefined
          : "Your password needs:",
    };
    if (next.name || next.email || next.password) return setErrors(next);

    setPending(true);
    const error = await onSave({ name: name.trim(), email: email.trim(), password, role });
    setPending(false);
    setErrors({ form: error ?? undefined });
  }

  const clear = (field: "name" | "email" | "password") =>
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));

  return (
    <>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Name"
          value={name}
          error={errors.name}
          maxLength={100}
          autoComplete="off"
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
            clear("name");
          }}
        />
        {member ? (
          <p className="text-sm text-ink-muted">Signs in with {member.email}.</p>
        ) : (
          <>
            <TextField
              label="Email"
              type="email"
              value={email}
              error={errors.email ?? emailHint(email)}
              hint="They sign in with this."
              maxLength={254}
              autoComplete="off"
              onChange={(e) => {
                setEmail(e.target.value);
                clear("email");
              }}
            />
            <PasswordField
              id="staff-password"
              label="Password"
              value={password}
              // The checklist below says what is missing, so the message only introduces it.
              error={errors.password}
              aria-describedby={errors.password ? "staff-password-message staff-password-rules" : "staff-password-rules"}
              maxLength={100}
              autoComplete="new-password"
              onChange={(e) => {
                setPassword(e.target.value);
                clear("password");
              }}
            />
            <PasswordRules id="staff-password-rules" password={password} showMissing={Boolean(errors.password)} />
          </>
        )}

        <SelectField label="Role" value={role} options={ROLE_OPTIONS} onChange={setRole} />

        {errors.form && (
          <p role="alert" className="text-sm text-danger">
            {errors.form}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            {member ? "Save changes" : "Add staff member"}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
