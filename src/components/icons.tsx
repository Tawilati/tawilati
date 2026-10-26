// Interface icons from brand/icons/ (24px grid, 2px stroke, currentColor).
// Copied path-for-path; regenerate from brand/tools/gen-icons.mjs rather than editing here.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

// brand/icons/tables.svg (custom)
export function TableIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="12" cy="8" rx="9" ry="3" />
      <path d="M5.5 10.4 4.6 19" />
      <path d="M18.5 10.4l.9 8.6" />
      <path d="M12 11v8" />
    </Icon>
  );
}

// brand/icons/ui/circle-alert.svg (Lucide "circle-alert")
export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </Icon>
  );
}
