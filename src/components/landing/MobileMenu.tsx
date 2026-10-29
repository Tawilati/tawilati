"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { XIcon } from "@/components/icons";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { SECTION_LINKS, focusRing } from "./shared";

// The nav on phones: one button that opens a panel under the bar.
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className={`text-ink hover:bg-surface-muted flex size-11 items-center justify-center rounded-lg ${focusRing}`}
      >
        {open ? (
          <XIcon className="size-6" />
        ) : (
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          className="bg-surface-secondary border-border-subtle absolute inset-x-0 top-full flex flex-col gap-1 border-b px-4 pt-2 pb-5 shadow-[var(--shadow-raised)]"
        >
          {SECTION_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              className={`text-ink flex min-h-11 items-center rounded-lg px-2 text-base font-medium ${focusRing}`}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-3 flex flex-col gap-3">
            <Link href="/register" onClick={close} className={buttonClassName({ variant: "primary", block: true })}>
              Register your business
            </Link>
            <Link href="/login" onClick={close} className={buttonClassName({ variant: "secondary", block: true })}>
              Sign in
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
