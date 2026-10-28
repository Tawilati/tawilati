"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";

export type SelectOption<T extends string> = { value: T; label: string; description?: string };

// A dropdown in the brand's look, in place of the browser's own select. The list opens under the field; the chosen
// option is ticked. Keyboard: Enter, Space or the arrows open it; arrows move; Enter picks; Escape closes.
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
  className,
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  // A sentence saying how to fix it, shown under the field.
  error?: string;
  className?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [active, setActive] = useState(selectedIndex);
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Handle this before the enclosing dialog's native document listener.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);

  function show() {
    setActive(selectedIndex);
    setOpen(true);
  }

  function pick(index: number) {
    if (trigger.current?.matches(":disabled") || !options[index]) return;
    onChange(options[index].value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape" && open) {
      // Closes the list only, not the pop-up around the form.
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return show();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + options.length) % options.length);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) pick(active);
      else show();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className={["tw-field", error && "tw-field--error", "relative", className].filter(Boolean).join(" ")}>
      <label className="tw-field__label" id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        aria-labelledby={`${id}-label ${id}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        disabled={options.length === 0}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className="tw-field__control w-full cursor-pointer text-left"
      >
        <span className="tw-field__input flex items-center">{selected?.label ?? "No options available"}</span>
        <ChevronRightIcon
          aria-hidden="true"
          className={`size-5 shrink-0 text-ink-muted transition-transform ${open ? "-rotate-90" : "rotate-90"}`}
        />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute inset-x-0 top-full z-10 mt-1 flex max-h-60 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border-strong bg-surface p-1.5 shadow-[0_8px_24px_rgba(32,43,38,0.18)]"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(index)}
                onClick={() => pick(index)}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 ${
                  index === active ? "bg-primary-tint" : ""
                }`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-sm ${isSelected ? "font-bold text-primary" : "font-semibold text-ink"}`}>{option.label}</span>
                  {option.description && <span className="text-[13px] text-ink-muted">{option.description}</span>}
                </span>
                {isSelected && <CheckIcon aria-hidden="true" className="size-5 shrink-0 text-primary" />}
              </li>
            );
          })}
        </ul>
      )}
      {error && <span id={`${id}-error`} className="tw-field__hint">{error}</span>}
    </div>
  );
}
