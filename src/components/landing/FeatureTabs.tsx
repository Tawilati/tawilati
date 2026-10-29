"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type Feature = { id: string; label: string; title: string; text: string; screen: ReactNode };

// Three screens, one window. The tab picks the screen and the sentence under it.
export function FeatureTabs({ features }: { features: Feature[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent) {
    const last = features.length - 1;
    const next =
      event.key === "ArrowRight" ? (active === last ? 0 : active + 1)
      : event.key === "ArrowLeft" ? (active === 0 ? last : active - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  const current = features[active];
  return (
    <div>
      <div role="tablist" aria-label="Product screens" onKeyDown={onKeyDown} className="border-border-strong flex gap-1 overflow-x-auto border-b [scrollbar-width:none]">
        {features.map((feature, index) => {
          const selected = index === active;
          return (
            <button
              key={feature.id}
              ref={(el) => {
                tabs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`feature-tab-${feature.id}`}
              aria-selected={selected}
              aria-controls="feature-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={`-mb-px min-h-12 shrink-0 cursor-pointer border-b-[3px] px-4 text-[15px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                selected ? "border-accent text-primary" : "text-ink-muted hover:text-ink hover:border-border-strong border-transparent"
              }`}
            >
              {feature.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="feature-panel"
        aria-labelledby={`feature-tab-${current.id}`}
        className="grid items-center gap-6 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-12"
      >
        <div key={`${current.id}-text`} className="tw-step flex max-w-md flex-col gap-3">
          <h3 className="font-display text-2xl sm:text-3xl">{current.title}</h3>
          <p className="text-ink-muted">{current.text}</p>
        </div>
        <div key={current.id} className="tw-step min-w-0">
          {current.screen}
        </div>
      </div>
    </div>
  );
}
