import { StatusBadge } from "@/components/ui";
import type { PublicMenuItem } from "@/types/Menu";
import { formatLBP, formatUSD } from "@/utils/money";

// One menu item in its own box: name, then USD first and LBP after (brand rule).
export function MenuItemCard({ item }: { item: PublicMenuItem }) {
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
      {item.soldOut && <StatusBadge status="SOLD_OUT" className="shrink-0" />}
    </li>
  );
}
