"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { XIcon } from "@/components/icons";

// Open pop-ups, oldest first: Escape closes only the newest, so a pop-up opened from another closes alone.
const openModals: symbol[] = [];
let originalBodyOverflow = "";

// The bare pop-up: a panel in the middle of the screen over a dimmed page. Closes with Escape or a tap outside, unless `locked`
// (a request is running). Focus moves to the first field or button, and the page behind doesn't scroll.
export function ModalFrame({
  title,
  children,
  role = "dialog",
  locked = false,
  onClose,
}: {
  title: string;
  children: ReactNode;
  role?: "dialog" | "alertdialog";
  locked?: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Latest props, so the listener below isn't rebuilt (and focus isn't moved) on every parent render.
  const latest = useRef({ locked, onClose });
  useEffect(() => {
    latest.current = { locked, onClose };
  });

  useEffect(() => {
    const me = Symbol("modal");
    if (openModals.length === 0) originalBodyOverflow = document.body.style.overflow;
    openModals.push(me);
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== me) return;
      if (event.key === "Escape" && !latest.current.locked) latest.current.onClose();
      if (event.key === "Tab") {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>(
          'input, select, textarea, button, a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? []).filter((element) => !element.matches(":disabled") && element.tabIndex >= 0 && element.getClientRects().length > 0);
        const index = controls.indexOf(document.activeElement as HTMLElement);
        if (!controls.length) {
          event.preventDefault();
          panel.current?.focus();
        } else if (event.shiftKey && index <= 0) {
          event.preventDefault();
          controls[controls.length - 1].focus();
        } else if (!event.shiftKey && (index === controls.length - 1 || index === -1)) {
          event.preventDefault();
          controls[0].focus();
        }
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      openModals.splice(openModals.indexOf(me), 1);
      if (openModals.length === 0) document.body.style.overflow = originalBodyOverflow;
      opener?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-[rgb(32_43_38/0.45)] p-4 sm:items-center"
      onClick={() => !locked && onClose()}
    >
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="my-auto flex w-full max-w-md flex-col gap-4 rounded-2xl bg-surface p-5 shadow-[var(--shadow-raised)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          {role === "dialog" && (
            <button
              type="button"
              aria-label="Close"
              disabled={locked}
              onClick={onClose}
              className="-mr-2 -mt-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted disabled:opacity-50"
            >
              <XIcon className="size-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
