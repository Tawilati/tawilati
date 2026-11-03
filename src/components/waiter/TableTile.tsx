import { formatUSD } from "@/utils/money";
import { elapsedLabel, STATE_LABEL, type FloorTile, type TableState } from "@/utils/waiterFloor";

// Solid tiles (brand/tokens.css --table-*); the state is always written out too, never colour alone.
export const TILE_LOOK: Record<TableState, string> = {
  free: "border border-dashed border-border-strong bg-surface text-ink-muted",
  ordered: "bg-table-ordered text-on-table-ordered",
  bill: "bg-table-bill text-on-table-bill",
  slowPay: "bg-table-slowpay text-on-table-slowpay",
  quiet: "bg-table-quiet text-on-table-quiet",
};

// One table on the waiter's floor. A free table isn't a button: there is nothing to open.
export function TableTile({ tile, now, onOpen }: { tile: FloorTile; now: number; onOpen: (tile: FloorTile) => void }) {
  // Bigger on a tablet or laptop, where the waiter reads it from further away.
  const look = `flex min-h-28 min-w-0 flex-col gap-0.5 rounded-xl p-3 text-left md:min-h-40 md:gap-1 md:rounded-2xl md:p-5 ${TILE_LOOK[tile.state]}`;
  const rounds = tile.tab ? `${tile.tab.orderCount} ${tile.tab.orderCount === 1 ? "round" : "rounds"}` : "";

  const body = (
    <>
      <span className="flex min-w-0 items-baseline justify-between gap-2">
        <span className={`truncate text-xl font-bold md:text-3xl ${tile.state === "free" ? "text-ink" : ""}`}>{tile.label}</span>
        {tile.since && <span className="shrink-0 text-xs tabular-nums opacity-90 md:text-sm">{elapsedLabel(tile.since, now)}</span>}
      </span>
      <span className="truncate text-sm font-semibold md:text-lg">{STATE_LABEL[tile.state]}</span>
      {tile.tab && (
        <span className="mt-auto flex min-w-0 items-center justify-between gap-1.5">
          <span className="truncate text-xs tabular-nums opacity-90 md:text-base">
            {rounds} · {formatUSD(tile.tab.totalUSD)}
          </span>
          {tile.readyCount > 0 && (
            <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-primary md:px-3 md:py-1 md:text-sm">
              {tile.readyCount} ready
            </span>
          )}
        </span>
      )}
    </>
  );

  if (!tile.tab) return <div className={look}>{body}</div>;
  return (
    <button
      type="button"
      onClick={() => onOpen(tile)}
      className={`${look} cursor-pointer transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      aria-label={`${tile.label}: ${STATE_LABEL[tile.state]}${tile.readyCount ? `, ${tile.readyCount} ready to serve` : ""}. Open the bill.`}
    >
      {body}
    </button>
  );
}
