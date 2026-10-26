"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  // Help under the field. Replaced by `error` when there is one.
  hint?: string;
  // A sentence saying how to fix it ("Enter a valid email address."), never an error code.
  error?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function TextField({ label, hint, error, icon, action, id, className, ...input }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className={["tw-field", error && "tw-field--error", className].filter(Boolean).join(" ")}>
      <label className="tw-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="tw-field__control">
        {icon}
        <input
          id={inputId}
          className="tw-field__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          {...input}
        />
        {action}
      </div>
      {message && (
        <span id={messageId} className="tw-field__hint">
          {message}
        </span>
      )}
    </div>
  );
}
