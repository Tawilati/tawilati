export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost";

export type ButtonLook = {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  block?: boolean;
  className?: string;
};

// The brand button classes, for a <Link> that should look like a button.
// Kept out of Button.tsx (a client file) so server components can call it.
export function buttonClassName({ variant = "primary", size = "md", block = false, className }: ButtonLook = {}) {
  return ["tw-btn", `tw-btn--${variant}`, size === "sm" && "tw-btn--sm", block && "tw-btn--block", className]
    .filter(Boolean)
    .join(" ");
}
