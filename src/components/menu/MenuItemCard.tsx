import type { PublicMenuItem } from "@/service/MenuService";
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
      {item.soldOut && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-soldout-tint px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap text-soldout">
          <span className="size-[7px] rounded-full bg-current" aria-hidden="true" />
          Sold out
        </span>
      )}
    </li>
  );
}
