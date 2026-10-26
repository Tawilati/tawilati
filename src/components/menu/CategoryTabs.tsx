// Category tabs pinned under the header. They share the width when few, and scroll sideways when many.
export function CategoryTabs({
  categories,
  activeId,
  onSelect,
}: {
  categories: { id: string; name: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Menu categories"
      className="sticky z-10 flex overflow-x-auto border-b border-border-subtle bg-surface-secondary px-1.5 [scrollbar-width:none]"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      {categories.map((category) => {
        const selected = category.id === activeId;
        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            id={`tab-${category.id}`}
            aria-selected={selected}
            aria-controls={`panel-${category.id}`}
            onClick={() => onSelect(category.id)}
            className={`min-h-12 shrink-0 grow basis-auto cursor-pointer border-b-[3px] px-4 text-sm font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
              selected ? "border-primary text-primary" : "border-transparent text-ink-muted"
            }`}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
