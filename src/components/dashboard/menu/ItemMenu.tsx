"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EllipsisVerticalIcon } from "@/components/icons";

// `danger` shows the action in red, set apart by a divider (for Delete).
export type ItemMenuAction = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

// The three-dots menu on an item card. Closes on a choice, an outside tap or Escape.
export function ItemMenu({
  itemName,
  actions,
}: {
  itemName: string;
  actions: ItemMenuAction[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // Closes the menu only, not a pop-up around it.
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={`Options for ${itemName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
      >
        <EllipsisVerticalIcon className="size-5" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={`Actions for ${itemName}`}
          onKeyDown={(event) => {
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === "ArrowDown" ? (index + 1) % buttons.length
              : event.key === "ArrowUp" ? (index - 1 + buttons.length) % buttons.length
              : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : null;
            if (next !== null) {
              event.preventDefault();
              buttons[next]?.focus();
            }
            if (event.key === "Tab") setOpen(false);
          }}
          className="absolute right-0 top-full z-10 mt-1 min-w-44 rounded-lg border border-border-strong bg-surface p-1.5 shadow-[0_8px_24px_rgba(32,43,38,0.18)]"
        >
          {actions.map((action) => (
            <div key={action.label}>
              {action.danger && (
                <div
                  role="separator"
                  className="mx-1 my-1.5 h-px bg-border-subtle"
                />
              )}
              <button
                type="button"
                role="menuitem"
                className={`flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-semibold ${
                  action.danger
                    ? "text-danger hover:bg-danger-tint"
                    : "text-ink hover:bg-primary-tint"
                }`}
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                  action.onSelect();
                }}
              >
                {action.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
