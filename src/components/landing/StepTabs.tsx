"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type Step = { title: string; text: string; screen: ReactNode };

// The four steps as tabs. Picking one swaps the picture beside it. Arrow keys, Home and End move between them.
export function StepTabs({ steps, heading }: { steps: Step[]; heading: ReactNode }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent) {
    const last = steps.length - 1;
    const next =
      event.key === "ArrowDown" || event.key === "ArrowRight" ? (active === last ? 0 : active + 1)
      : event.key === "ArrowUp" || event.key === "ArrowLeft" ? (active === 0 ? last : active - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
      <div>
      {heading}
      <div role="tablist" aria-label="How it works" aria-orientation="vertical" onKeyDown={onKeyDown} className="flex flex-col">
        {steps.map((step, index) => {
          const selected = index === active;
          return (
            <button
              key={step.title}
              ref={(el) => {
                tabs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`step-tab-${index}`}
              aria-selected={selected}
              aria-controls="step-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={`group flex min-h-16 cursor-pointer gap-4 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected ? "border-on-primary/15 bg-on-primary/10" : "hover:bg-on-primary/5 border-transparent"
              }`}
            >
              <span
                aria-hidden="true"
                className={`font-display flex size-10 shrink-0 items-center justify-center rounded-full text-lg transition-colors ${
                  selected ? "bg-accent text-ink" : "bg-on-primary/10 text-on-primary group-hover:bg-accent/40"
                }`}
              >
                {index + 1}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-lg font-semibold">{step.title}</span>
                {selected && <span className="text-on-primary/80 text-[15px]">{step.text}</span>}
              </span>
            </button>
          );
        })}
      </div>
      </div>

      <div
        role="tabpanel"
        id="step-panel"
        aria-labelledby={`step-tab-${active}`}
        className="border-on-primary/10 bg-on-primary/5 flex min-h-[520px] items-center justify-center rounded-3xl border p-5 sm:p-8"
      >
        <div key={active} className="tw-step flex w-full justify-center">
          {steps[active].screen}
        </div>
      </div>
    </div>
  );
}
