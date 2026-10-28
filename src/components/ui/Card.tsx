import type { HTMLAttributes } from "react";

// White panel with the brand border, radius and soft shadow. Use it to set one block apart, not around everything.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={["tw-card", className].filter(Boolean).join(" ")} {...props} />;
}
