import type { ReactNode } from "react";

// The three page sections the nav and footer link to.
export const SECTION_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
] as const;

export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Same content width as the nav, so every section lines up with it.
export const contentWidth = "mx-auto w-full max-w-6xl px-4 sm:px-6";

const TONES = {
  base: "",
  white: "bg-surface border-y border-border-subtle",
  muted: "bg-surface-muted border-y border-border-subtle",
  dark: "bg-primary text-on-primary",
} as const;

export function Section({
  id,
  tone = "base",
  children,
}: {
  id?: string;
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-16 ${TONES[tone]}`}>
      <div className={`${contentWidth} py-12 sm:py-16`}>{children}</div>
    </section>
  );
}

// A short amber rule and a small label above a heading. The one detail every section shares.
export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.12em] uppercase ${className}`}>
      <span aria-hidden="true" className="bg-accent h-0.5 w-8 rounded-full" />
      {children}
    </p>
  );
}

export function H2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`font-display text-3xl leading-tight text-balance sm:text-4xl ${className}`}>{children}</h2>
  );
}
