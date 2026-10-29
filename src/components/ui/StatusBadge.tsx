import type { ReactNode } from "react";

// Order round statuses (DiningOrder.status), the closed tab, sold-out items and disabled tables.
export type BadgeStatus = "NEW" | "PREPARING" | "READY" | "SERVED" | "CLOSED" | "SOLD_OUT" | "DISABLED";

const LOOK: Record<BadgeStatus, { className: string; label: string }> = {
  NEW: { className: "tw-badge--new", label: "New" },
  PREPARING: { className: "tw-badge--preparing", label: "Preparing" },
  READY: { className: "tw-badge--ready", label: "Ready" },
  SERVED: { className: "tw-badge--served", label: "Served" },
  CLOSED: { className: "tw-badge--closed", label: "Closed" },
  SOLD_OUT: { className: "tw-badge--soldout", label: "Sold out" },
  DISABLED: { className: "tw-badge--disabled", label: "Disabled" },
};

// Always shows a word: colour never carries the status alone (brand rule).
export function StatusBadge({
  status,
  children,
  className,
}: {
  status: BadgeStatus;
  children?: ReactNode;
  className?: string;
}) {
  const { className: look, label } = LOOK[status];
  return <span className={["tw-badge", look, className].filter(Boolean).join(" ")}>{children ?? label}</span>;
}
