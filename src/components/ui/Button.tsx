"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { buttonClassName, type ButtonLook } from "./buttonStyles";

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
