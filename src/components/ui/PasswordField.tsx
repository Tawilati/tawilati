"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon } from "@/components/icons";
import { TextField, type TextFieldProps } from "./TextField";

// A TextField with a lock icon and an eye button that shows or hides the password.
export function PasswordField(props: Omit<TextFieldProps, "type" | "icon" | "action">) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      icon={<LockIcon className="size-5 shrink-0" />}
      action={
        <button
          type="button"
          className="tw-field__action"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
        </button>
      }
    />
  );
}
