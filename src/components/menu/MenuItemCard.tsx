import { AddButton, QuantityStepper, StatusBadge } from "@/components/ui";
import type { PublicMenuItem } from "@/types/Menu";
import { formatLBP, formatUSD } from "@/utils/money";

// One menu item in its own box: name, then USD first and LBP after (brand rule).
// On the right: + to add it, − n + once it's in the cart, or the sold-out badge.
export function MenuItemCard({
  item,
  qty,
  onChange,
  canAdd = true,
}: {
  item: PublicMenuItem;
  qty: number;
  onChange: (item: PublicMenuItem, delta: number) => void;
  canAdd?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border border-border-subtle p-4 ${
        item.soldOut ? "bg-surface-muted" : "bg-surface"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={`text-base font-semibold ${item.soldOut ? "text-ink-muted" : "text-ink"}`}>{item.name}</p>
        <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
          <span className={`text-[17px] font-bold ${item.soldOut ? "text-ink-muted" : "text-ink"}`}>
            {formatUSD(item.priceUSD)}
          </span>
          <span className="text-[13px] text-ink-muted">{formatLBP(item.priceLBP)}</span>
        </p>
      </div>
      {item.soldOut ? (
        <StatusBadge status="SOLD_OUT" className="shrink-0" />
      ) : qty > 0 ? (
        <QuantityStepper
          itemName={item.name}
          value={qty}
          onDecrease={() => onChange(item, -1)}
          onIncrease={() => onChange(item, 1)}
        />
      ) : (
        <AddButton itemName={item.name} onClick={() => onChange(item, 1)} disabled={!canAdd} />
      )}
    </li>
  );
}
