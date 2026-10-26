"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";

export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost";

type ButtonLook = {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  block?: boolean;
  className?: string;
};

// The brand button classes, for a <Link> that should look like a button.
export function buttonClassName({ variant = "primary", size = "md", block = false, className }: ButtonLook = {}) {
  return ["tw-btn", `tw-btn--${variant}`, size === "sm" && "tw-btn--sm", block && "tw-btn--block", className]
    .filter(Boolean)
    .join(" ");
}

// Primary = Forest Green, for the main action on a screen. Accent (amber) is for promotions only.
// While `loading`, the label is kept for width, a spinner shows, and clicks are ignored (no double submits).
export function Button({
  variant,
  size,
  block,
  loading = false,
  className,
  type = "button",
  onClick,
  children,
  ...props
}: ButtonLook & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, block, className })}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}
